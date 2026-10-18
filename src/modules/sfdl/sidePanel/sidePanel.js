import { LightningElement, api } from 'lwc';
import { adoptStyleSheet } from 'sfdl/styleSheets';
import { adoptCompareTheme } from 'sfdl/compareTheme';
import { css } from './sidePanelCss';

const TOGGLE_PANEL_LEFT_ICON = '/slds/icons/utility/toggle_panel_left.svg';
const TOGGLE_PANEL_RIGHT_ICON = '/slds/icons/utility/toggle_panel_right.svg';
const COLLAPSED_WIDTH = '2.5rem';
const BACK_TO_TOP_ICON = '/resources/chevronUpBlue.svg';
//How far down the list scrolls, in panels, before the way back comes.
const BACK_TO_TOP_AFTER = 0.5;

//A panel docked to one edge of a compare tab that folds into a thin strip.
//Given a side, its header takes the tint of that side.
export default class SidePanel extends LightningElement{
    @api title;
    @api subtitle;
    //Names a panel without a title, whose header holds a picker instead: on
    //its toggle and on its folded strip.
    @api label;
    //left or right: the colour of the panel, none for a neutral one.
    @api side;
    //left or right: the edge the panel is docked to, the side when not given.
    @api dock;
    @api width = '20rem';

    @api
    get collapsed(){
        return this._collapsed;
    }
    set collapsed(value){
        this._collapsed = !!value;
    }

    //Opt in: a long list gets a way back to its top at the foot of the panel.
    @api
    get backToTop(){
        return this._backToTop;
    }
    set backToTop(value){
        this._backToTop = value === true || value === '' || value === 'true';
    }

    _collapsed = false;
    _backToTop = false;
    isBackToTopVisible = false;
    backToTopFrame;
    backToTopIcon = BACK_TO_TOP_ICON;

    connectedCallback(){
        adoptStyleSheet(css);
        adoptCompareTheme();
    }

    disconnectedCallback(){
        this.cancelBackToTopFrame();
    }

    get bodyTabIndex(){
        //The list takes the focus from the button, never from Tab.
        return this._backToTop ? '-1' : undefined;
    }

    //The wrapper around the button carries the motion, the button keeps its look.
    get backToTopClass(){
        return 'sfdl-side-panel__back-to-top' + (this.isBackToTopVisible ? ' sfdl-side-panel__back-to-top_visible' : '');
    }

    get backToTopHidden(){
        return this.isBackToTopVisible ? 'false' : 'true';
    }

    get backToTopTabIndex(){
        return this.isBackToTopVisible ? '0' : '-1';
    }

    //The body scrolled: one check, on the next frame. Not an intersection
    //observer: a jump from the top straight down a long list, a drag of the
    //scrollbar or End, crosses nothing for it to see.
    handleBodyScroll(){
        if(!this._backToTop || this.backToTopFrame){
            return;
        }

        if(typeof requestAnimationFrame !== 'function'){
            this.updateBackToTop();
            return;
        }

        this.backToTopFrame = requestAnimationFrame(() => {
            this.backToTopFrame = undefined;
            this.updateBackToTop();
        });
    }

    updateBackToTop(){
        const body = this.template.querySelector('.sfdl-side-panel__body');

        if(!body){
            return;
        }

        const isScrolledDown = body.scrollTop > body.clientHeight * BACK_TO_TOP_AFTER;

        if(isScrolledDown !== this.isBackToTopVisible){
            this.isBackToTopVisible = isScrolledDown;
        }
    }

    cancelBackToTopFrame(){
        if(this.backToTopFrame && typeof cancelAnimationFrame === 'function'){
            cancelAnimationFrame(this.backToTopFrame);
        }

        this.backToTopFrame = undefined;
    }

    //Back to the top, gliding unless motion is to be reduced, and the focus
    //handed to the list first: a focus is a scroll of its own, and one that
    //follows the glide would cut it short.
    handleBackToTop(){
        const body = this.template.querySelector('.sfdl-side-panel__body');
        const reduceMotion = typeof window.matchMedia === 'function' &&
            window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        this.isBackToTopVisible = false;

        if(!body){
            return;
        }

        body.focus({ preventScroll: true });

        if(typeof body.scrollTo === 'function'){
            body.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
        } else {
            body.scrollTop = 0;
        }
    }

    get dockedTo(){
        return this.dock || this.side || 'left';
    }

    get isDockedRight(){
        return this.dockedTo === 'right';
    }

    get panelClass(){
        return 'sfdl-side-panel sfdl-side-panel_dock-' + this.dockedTo +
            (this.side ? ' sfdl-side-panel_' + this.side : '') +
            (this.title ? '' : ' sfdl-side-panel_untitled') +
            (this._collapsed ? ' sfdl-side-panel_collapsed' : '');
    }

    get panelStyle(){
        return 'width:' + (this._collapsed ? COLLAPSED_WIDTH : this.width) + ';';
    }

    get contentClass(){
        return 'sfdl-side-panel__content' + (this._collapsed ? ' slds-hide' : '');
    }

    //A left panel folds towards the left edge and opens towards the right,
    //a right panel the other way round.
    get collapseIcon(){
        return this.isDockedRight ? TOGGLE_PANEL_RIGHT_ICON : TOGGLE_PANEL_LEFT_ICON;
    }

    get expandIcon(){
        return this.isDockedRight ? TOGGLE_PANEL_LEFT_ICON : TOGGLE_PANEL_RIGHT_ICON;
    }

    get name(){
        return this.title || this.label;
    }

    get collapseTitle(){
        return 'Collapse ' + (this.name || 'panel');
    }

    get expandTitle(){
        return 'Expand ' + (this.name || 'panel');
    }

    handleToggle(){
        this._collapsed = !this._collapsed;
        this.dispatchEvent(new CustomEvent('toggle', {
            detail: { collapsed: this._collapsed }
        }));
    }
}
