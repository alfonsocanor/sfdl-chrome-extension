import { LightningElement, api } from 'lwc';
import { adoptStyleSheet } from 'sfdl/styleSheets';
import { css } from './skeletonCss';

const ROW_CLASS = 'sfdl-skeleton__row';
const DEFAULT_SHAPE = [{ lines: 2 }];
//The widths of the lines of text, row after row, so the rows do not all look
//alike, in percent of the room the text has.
const LINE_WIDTHS = [[92, 64], [78, 70], [96, 46], [70, 58]];

function squareBone(size, index){
    return {
        key: 'bone-' + index,
        className: 'sfdl-skeleton__bone sfdl-skeleton__square',
        style: 'width:' + size + 'px;height:' + size + 'px;',
        lines: []
    };
}

function textBone(lineCount, row, index){
    const widths = LINE_WIDTHS[row % LINE_WIDTHS.length];

    return {
        key: 'bone-' + index,
        className: 'sfdl-skeleton__text',
        style: '',
        lines: Array.from({ length: lineCount }, (unused, line) => ({
            key: 'line-' + line,
            style: 'width:' + widths[line % widths.length] + '%;'
        }))
    };
}

//The outline of a list while its content is on its way, in place of a
//spinner. It knows nothing of what it stands for: the list hands it the shape
//of one of its rows and its own classes, so the outline takes the place, the
//spacing and the look the rows will have.
export default class Skeleton extends LightningElement{
    //How many rows stand for the content on its way.
    @api rows = 5;
    //One row, left to right: { square: px } for a checkbox or an icon,
    //{ lines: n } for text taking the room left.
    @api shape = DEFAULT_SHAPE;
    //The classes of the list, of its items and of the row inside an item.
    @api listClass = '';
    @api itemClass = '';
    @api rowClass = '';
    @api label = 'Loading';

    connectedCallback(){
        adoptStyleSheet(css);
    }

    get rowClassName(){
        return ROW_CLASS + (this.rowClass ? ' ' + this.rowClass : '');
    }

    get items(){
        const count = parseInt(this.rows, 10) || 0;
        const shape = this.shape && this.shape.length ? this.shape : DEFAULT_SHAPE;

        return Array.from({ length: count }, (unused, row) => ({
            key: 'row-' + row,
            bones: shape.map((bone, index) =>
                bone.square ? squareBone(bone.square, index) : textBone(bone.lines || 1, row, index)
            )
        }));
    }
}
