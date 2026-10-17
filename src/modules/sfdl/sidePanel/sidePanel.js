import { LightningElement, api } from 'lwc';
import { adoptStyleSheet } from 'sfdl/styleSheets';
import { adoptCompareTheme } from 'sfdl/compareTheme';
import { css } from './sidePanelCss';

const TOGGLE_PANEL_LEFT_ICON = '/slds/icons/utility/toggle_panel_left.svg';
const TOGGLE_PANEL_RIGHT_ICON = '/slds/icons/utility/toggle_panel_right.svg';
const COLLAPSED_WIDTH = '2.5rem';

//A panel docked to one edge of a compare tab that folds into a thin strip.
//Given a side, its header takes the tint of that side.
export default class SidePanel extends LightningElement{
    @api title;
    @api subtitle;
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

    _collapsed = false;

    connectedCallback(){
        adoptStyleSheet(css);
        adoptCompareTheme();
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
            (this._collapsed ? ' sfdl-side-panel_collapsed' : '');
    }

    get panelStyle(){
        return 'width:' + (this._collapsed ? COLLAPSED_WIDTH : this.width) + ';';
    }

    get contentClass(){
        return 'sfdl-side-panel__content' + (this._collapsed ? ' slds-hide' : '');
    }

    get swatchClass(){
        return 'sfdl-side-swatch sfdl-side-swatch_' + this.side;
    }

    //A left panel folds towards the left edge and opens towards the right,
    //a right panel the other way round.
    get collapseIcon(){
        return this.isDockedRight ? TOGGLE_PANEL_RIGHT_ICON : TOGGLE_PANEL_LEFT_ICON;
    }

    get expandIcon(){
        return this.isDockedRight ? TOGGLE_PANEL_LEFT_ICON : TOGGLE_PANEL_RIGHT_ICON;
    }

    get collapseTitle(){
        return 'Collapse ' + (this.title || 'panel');
    }

    get expandTitle(){
        return 'Expand ' + (this.title || 'panel');
    }

    handleToggle(){
        this._collapsed = !this._collapsed;
        this.dispatchEvent(new CustomEvent('toggle', {
            detail: { collapsed: this._collapsed }
        }));
    }
}
