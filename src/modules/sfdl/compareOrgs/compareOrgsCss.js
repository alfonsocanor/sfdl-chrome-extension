export const css = `
    sfdl-compare-orgs {
        display: block;
    }

    .sfdl-compare-orgs {
        display: flex;
        flex-direction: column;
        background: #fafaf9;
    }

    .sfdl-compare-orgs__toolbar {
        display: flex;
        flex: 0 0 auto;
        flex-wrap: wrap;
        align-items: flex-end;
        gap: 8px 12px;
        padding: 8px 12px;
        background: #ffffff;
        border-bottom: 1px solid #dddbda;
    }

    .sfdl-compare-orgs__org {
        width: 17rem;
    }

    .sfdl-compare-orgs__type {
        width: 15rem;
    }

    .sfdl-compare-orgs__toolbar-button {
        margin-bottom: 5px;
    }

    .sfdl-compare-orgs__managed {
        display: inline-flex;
        align-items: center;
        gap: 4px;
        margin-bottom: 7px;
        color: #3e3e3c;
        font-size: 12px;
        cursor: pointer;
        white-space: nowrap;
    }

    .sfdl-compare-orgs__managed input {
        width: 14px;
        height: 14px;
        margin: 0;
        cursor: pointer;
    }

    .sfdl-compare-orgs__body {
        display: flex;
        flex: 1 1 auto;
        min-height: 0;
    }

    .sfdl-compare-orgs__diff {
        flex: 1 1 auto;
        min-width: 0;
        height: 100%;
    }

    .sfdl-compare-orgs__diff sfdl-diff-viewer {
        height: 100%;
    }
`;
