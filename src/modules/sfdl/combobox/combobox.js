import { LightningElement, api } from 'lwc';
import { adoptStyleSheet } from 'sfdl/styleSheets';
import { adoptCompareTheme } from 'sfdl/compareTheme';
import { areStepBadgesDismissed, dismissStepBadges, onStepBadgesDismissed } from 'sfdl/stepBadges';
import { css } from './comboboxCss';

const DOWN_ICON = '/slds/icons/utility/down.svg';
const OPTION_CLASS = 'slds-media slds-listbox__option slds-listbox__option_plain slds-media_small';

//The slds combobox of the org picker, for any list of options. Options are
//{ label, value, group }: the ones sharing a group are listed under its header,
//in the order the groups first appear.
export default class Combobox extends LightningElement{
    @api label;
    @api placeholder = 'Select an option';
    @api emptyMessage = 'Nothing to pick from';
    @api disabled = false;
    //left or right: the border takes the colour of that side and stands in
    //for the label, which shows on hover.
    @api side;
    //The number of the step this picker is, in light green on its top right
    //corner while it has no value; pulsing for the step to take next.
    @api badge;
    @api badgePulse = false;

    @api
    get options(){
        return this._options;
    }
    set options(options){
        this._options = options || [];
    }

    @api
    get value(){
        return this._value;
    }
    set value(value){
        this._value = value;
    }

    _options = [];
    _value;
    isOpen = false;
    highlightedValue;
    downIcon = DOWN_ICON;

    //Hidden until the storage says the user did not close them for good.
    areBadgesDismissed = true;
    //The ding the badge comes in with plays once: shown again with its tab or
    //its view, it stays still.
    isBadgeSettled = false;

    connectedCallback(){
        adoptStyleSheet(css);
        adoptCompareTheme();
        this.stopListeningToBadges = onStepBadgesDismissed(() => {
            this.areBadgesDismissed = true;
        });
        areStepBadgesDismissed().then(dismissed => {
            this.areBadgesDismissed = dismissed;
        });
    }

    disconnectedCallback(){
        if(this.stopListeningToBadges){
            this.stopListeningToBadges();
        }
    }

    get selectedOption(){
        return this._options.find(option => option.value === this._value);
    }

    get displayLabel(){
        return this.selectedOption ? this.selectedOption.label : this.placeholder;
    }

    //With a side, the tooltip tells the org name already.
    get buttonTitle(){
        return this.selectedOption && !this.side ? this.selectedOption.label : '';
    }

    get valueClass(){
        return 'slds-truncate' + (this.selectedOption ? '' : ' sfdl-combobox-placeholder');
    }

    get showBadge(){
        return !this.areBadgesDismissed &&
            this.badge !== undefined && this.badge !== null && this.badge !== '' &&
            !this.selectedOption;
    }

    get badgeClass(){
        return 'slds-notification-badge sfdl-combobox-badge' +
            (this.isBadgeSettled ? '' : ' sfdl-combobox-badge_entering') +
            (this.badgePulse ? ' sfdl-combobox-badge_pulse' : '');
    }

    get badgeTitle(){
        return 'Step ' + this.badge + (this.label ? ': ' + this.label : '') + '. Click to hide the numbers of the steps';
    }

    handleBadgeAnimationEnd(event){
        if(event.animationName === 'ding'){
            this.isBadgeSettled = true;
        }
    }

    handleBadgeDismiss(event){
        event.stopPropagation();
        dismissStepBadges();
    }

    get showLabel(){
        return !!this.label && !this.side;
    }

    get controlClass(){
        return 'slds-form-element__control' + (this.side ? ' sfdl-combobox-control_side sfdl-combobox-control_' + this.side : '');
    }

    //A picker on the right opens its tooltip towards the inside of the page,
    //so a long org name never reaches past its right edge.
    get tooltipClass(){
        return 'slds-popover slds-popover_tooltip sfdl-combobox-tooltip ' +
            (this.side === 'right' ? 'slds-nubbin_top-right sfdl-combobox-tooltip_right' : 'slds-nubbin_top-left');
    }

    //Open, the list takes the place of the tooltip.
    get showTooltip(){
        return !!this.side && !!this.label && !this.isOpen;
    }

    get comboboxClass(){
        return 'slds-combobox slds-dropdown-trigger slds-dropdown-trigger_click' + (this.isOpen ? ' slds-is-open' : '');
    }

    get ariaExpanded(){
        return this.isOpen ? 'true' : 'false';
    }

    get isEmpty(){
        return !this._options.length;
    }

    get items(){
        const optionsByGroup = new Map();

        this._options.forEach(option => {
            const group = option.group || '';
            if(!optionsByGroup.has(group)){
                optionsByGroup.set(group, []);
            }
            optionsByGroup.get(group).push(option);
        });

        const items = [];
        optionsByGroup.forEach((options, group) => {
            if(group){
                items.push({ key: 'group-' + group, label: group, isGroup: true });
            }
            options.forEach(option => {
                const isSelected = option.value === this._value;
                const isHighlighted = option.value === this.highlightedValue;
                items.push({
                    key: 'option-' + option.value,
                    label: option.label,
                    value: option.value,
                    isGroup: false,
                    ariaSelected: isSelected ? 'true' : 'false',
                    optionClass: OPTION_CLASS +
                        (isSelected ? ' sfdl-combobox-option_selected' : '') +
                        (isHighlighted ? ' slds-has-focus' : '')
                });
            });
        });

        return items;
    }

    //The options in the order they are listed, which is not the order they
    //were given when their groups are interleaved.
    get listedOptions(){
        return this.items.filter(item => !item.isGroup);
    }

    handleToggle(){
        if(this.isOpen){
            this.close();
        } else {
            this.open();
        }
    }

    open(){
        this.isOpen = true;
        this.highlightedValue = this._value;
    }

    close(){
        this.isOpen = false;
        this.highlightedValue = undefined;
    }

    handleBlur(){
        this.close();
    }

    //A click on the list would take the focus off the button and close the
    //list before the click lands on the option.
    keepFocusOnButton(event){
        event.preventDefault();
    }

    handleSelect(event){
        this.select(event.currentTarget.dataset.value);
    }

    select(value){
        const option = this._options.find(candidate => String(candidate.value) === String(value));
        this.close();

        if(!option){
            return;
        }

        const hasChanged = option.value !== this._value;
        this._value = option.value;

        if(hasChanged){
            this.dispatchEvent(new CustomEvent('change', {
                detail: { value: option.value, option }
            }));
        }
    }

    handleKeyDown(event){
        if(event.key === 'ArrowDown' || event.key === 'ArrowUp'){
            event.preventDefault();
            if(!this.isOpen){
                this.open();
            }
            this.moveHighlight(event.key === 'ArrowDown' ? 1 : -1);
        } else if(event.key === 'Enter' && this.isOpen && this.highlightedValue !== undefined){
            event.preventDefault();
            this.select(this.highlightedValue);
        } else if(event.key === 'Escape' && this.isOpen){
            event.preventDefault();
            this.close();
        }
    }

    moveHighlight(step){
        const options = this.listedOptions;

        if(!options.length){
            return;
        }

        const currentIndex = options.findIndex(option => option.value === this.highlightedValue);
        const nextIndex = currentIndex === -1 ?
            (step > 0 ? 0 : options.length - 1) :
            (currentIndex + step + options.length) % options.length;

        this.highlightedValue = options[nextIndex].value;
    }
}
