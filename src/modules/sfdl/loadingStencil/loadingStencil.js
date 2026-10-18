import { LightningElement, api } from 'lwc';
import { adoptStyleSheet } from 'sfdl/styleSheets';
import logListStencil from './logListStencil/logListStencil.html';
import compareLogListStencil from './compareLogListStencil/compareLogListStencil.html';
import componentListStencil from './componentListStencil/componentListStencil.html';
import codeStencil from './codeStencil/codeStencil.html';
// The bundle's own empty template, the fallback in render(), see there.
import emptyStencil from './loadingStencil.html';
import { css } from './loadingStencilCss';

const TEMPLATES = {
    logList: logListStencil,
    compareLogList: compareLogListStencil,
    componentList: componentListStencil,
    log: codeStencil,
    diff: codeStencil
};

const DEFAULT_ROWS = 8;
const DEFAULT_CODE_LINES = 40;

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

//What stands in a place while what it shows is on its way: one template per
//thing it stands for, each drawn the way that thing is, so nothing moves when
//the real one comes. The type picks the template.
export default class LoadingStencil extends LightningElement{
    //logList, compareLogList, componentList, log or diff.
    @api type;
    //How many rows a list draws.
    @api rows;
    //compareLogList: the tick of a list feeding both sides.
    @api ticks = false;
    //log and diff: how many panes, two for a diff side by side.
    @api panes;
    //log and diff: how many lines a pane draws.
    @api lines;
    //log and diff: what is on its way, written above the lines.
    @api message;
    @api label = 'Loading';

    connectedCallback(){
        adoptStyleSheet(css);
    }

    get rowList(){
        return listOf(parseInt(this.rows, 10) || DEFAULT_ROWS, 'row');
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
