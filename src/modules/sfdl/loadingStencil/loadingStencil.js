import { LightningElement, api } from 'lwc';
import { adoptStyleSheet } from 'sfdl/styleSheets';
import logListStencil from './logListStencil/logListStencil.html';
import compareLogListStencil from './compareLogListStencil/compareLogListStencil.html';
import componentListStencil from './componentListStencil/componentListStencil.html';
import codeStencil from './codeStencil/codeStencil.html';
import monitorCardStencil from './monitorCardStencil/monitorCardStencil.html';
import monitorMetersStencil from './monitorMetersStencil/monitorMetersStencil.html';
// The bundle's own empty template, the fallback in render(), see there.
import emptyStencil from './loadingStencil.html';
import { css } from './loadingStencilCss';

const TEMPLATES = {
    logList: logListStencil,
    compareLogList: compareLogListStencil,
    componentList: componentListStencil,
    log: codeStencil,
    diff: codeStencil,
    monitorCard: monitorCardStencil,
    monitorMeters: monitorMetersStencil
};

const DEFAULT_ROWS = 8;
const DEFAULT_CODE_LINES = 40;
//The lists that fill the room left under them when no count is asked.
const LIST_TYPES = ['logList', 'compareLogList', 'componentList'];

//The lines of a log, as its calls step in and out: how deep each one sits and
//how much of the pane it takes, in percent. Repeated as long as the pane asks.
const CODE_LINES = [
    [0, 72], [0, 54], [0, 38], [0, 66], [1, 58], [2, 70], [2, 44], [2, 62],
    [1, 50], [1, 36], [0, 60], [0, 48], [1, 64], [2, 52], [2, 40], [1, 46],
    [0, 34], [0, 56], [0, 42], [0, 30]
];

function listOf(count, prefix){
    return Array.from({ length: count }, (unused, index) => ({ key: prefix + '-' + index }));
}

//Between 0 and 1, and the same for the same row of the same stencil, so the
//lengths look picked at random and a row keeps its own when it draws again.
function noise(seed, index, salt){
    const value = Math.sin(seed * 9301 + index * 49297 + salt * 233.3) * 43758.5453;
    return value - Math.floor(value);
}

function percentBetween(min, max, value){
    return 'width:' + Math.round(min + (max - min) * value) + '%;';
}

//Where a node is laid out: in the slot it is handed to, if any, as a list
//handed to a panel scrolls in the body of the panel, not in the panel itself.
function layoutParentOf(node){
    return node.assignedSlot || node.parentNode || node.host || null;
}

//The element the stencil scrolls in, through the components holding it.
function scrollContainerOf(element){
    let node = layoutParentOf(element);

    while(node && node !== document){
        if(node.nodeType === 1){
            const overflowY = getComputedStyle(node).overflowY;

            if(overflowY === 'auto' || overflowY === 'scroll'){
                return node;
            }
        }

        node = layoutParentOf(node);
    }

    return null;
}

//What stands in a place while what it shows is on its way: one template per
//thing it stands for, each drawn the way that thing is, so nothing moves when
//the real one comes. The type picks the template.
export default class LoadingStencil extends LightningElement{
    //logList, compareLogList, componentList, log, diff, monitorCard or
    //monitorMeters.
    @api type;
    //How many rows a list draws. Without one, a list draws as many as fill
    //the room left under it, down to the bottom of what it scrolls in, and no
    //more, so that never scrolls.
    @api rows;
    //compareLogList: the tick of a list feeding both sides.
    @api ticks = false;
    //log and diff: how many panes, two for a diff side by side.
    @api panes;
    //log and diff: how many lines a pane draws.
    @api lines;
    //What is on its way, for screen readers.
    @api label = 'Loading';

    seed = Math.random();
    fittedRows = DEFAULT_ROWS;
    fittedHeight;

    connectedCallback(){
        adoptStyleSheet(css);
        window.addEventListener('resize', this.handleResize);
    }

    disconnectedCallback(){
        window.removeEventListener('resize', this.handleResize);
    }

    renderedCallback(){
        this.fitRows();
    }

    handleResize = () => {
        this.fitRows();
    };

    get isFilling(){
        return LIST_TYPES.includes(this.type) && !parseInt(this.rows, 10);
    }

    get fillStyle(){
        return this.isFilling && this.fittedHeight !== undefined ?
            'height:' + this.fittedHeight + 'px;overflow:hidden;' :
            '';
    }

    get rowList(){
        const count = this.isFilling ? this.fittedRows : parseInt(this.rows, 10) || DEFAULT_ROWS;

        return Array.from({ length: count }, (unused, index) => ({
            key: 'row-' + index,
            firstLineStyle: percentBetween(58, 96, noise(this.seed, index, 1)),
            secondLineStyle: percentBetween(28, 74, noise(this.seed, index, 2)),
            nameStyle: percentBetween(26, 72, noise(this.seed, index, 3))
        }));
    }

    //As many rows as reach the bottom of the room left, the last one cut by
    //it, and the stencil as high as that room, so nothing scrolls. Without a
    //layout to measure, the rows stay as they are.
    fitRows(){
        if(!this.isFilling){
            return;
        }

        const root = this.template.querySelector('.sfdl-stencil');
        const items = this.template.querySelectorAll('ul > li');
        const container = scrollContainerOf(this.template.host);

        if(!root || !items.length || !container){
            return;
        }

        const bottom = container.getBoundingClientRect().bottom - (parseFloat(getComputedStyle(container).paddingBottom) || 0);
        const firstRow = items[0].getBoundingClientRect();
        const rowPitch = items.length > 1 ? items[1].getBoundingClientRect().top - firstRow.top : firstRow.height;
        const height = Math.floor(bottom - root.getBoundingClientRect().top);

        if(height <= 0 || rowPitch <= 0){
            return;
        }

        const rows = Math.max(1, Math.ceil((bottom - firstRow.top) / rowPitch));

        if(rows !== this.fittedRows){
            this.fittedRows = rows;
        }

        if(height !== this.fittedHeight){
            this.fittedHeight = height;
        }
    }

    get showsTicks(){
        return !!this.ticks;
    }

    get paneList(){
        const defaultPanes = this.type === 'diff' ? 2 : 1;
        return listOf(parseInt(this.panes, 10) || defaultPanes, 'pane');
    }

    get codeLineList(){
        const count = parseInt(this.lines, 10) || DEFAULT_CODE_LINES;

        return Array.from({ length: count }, (unused, index) => {
            const [depth, width] = CODE_LINES[index % CODE_LINES.length];
            return {
                key: 'line-' + index,
                style: 'margin-left:' + (depth * 1.5) + 'rem;width:' + width + '%;'
            };
        });
    }

    render(){
        //An unknown type draws nothing rather than throwing: render() must
        //return an imported template, and an empty box beats a broken panel.
        return TEMPLATES[this.type] || emptyStencil;
    }
}
