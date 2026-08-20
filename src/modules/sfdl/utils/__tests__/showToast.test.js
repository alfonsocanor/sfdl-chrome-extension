import { showToastEvent } from 'sfdl/utils';

const toasts = () => document.querySelectorAll('sfdl-toast');

describe('showToastEvent', () => {
    beforeEach(() => {
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it('appends a toast to the page with the given content', () => {
        showToastEvent('success', 'sfdl', 'Log downloaded');

        expect(toasts().length).toBe(1);
        expect(toasts()[0].action).toBe('success');
        expect(toasts()[0].header).toBe('sfdl');
        expect(toasts()[0].message).toBe('Log downloaded');
    });

    it('keeps a single toast on screen at a time', () => {
        showToastEvent('info', 'sfdl', 'first');
        showToastEvent('error', 'sfdl', 'second');

        expect(toasts().length).toBe(1);
        expect(toasts()[0].message).toBe('second');
    });

    it('removes the toast after the default delay', () => {
        showToastEvent('success', 'sfdl', 'Log downloaded');

        jest.advanceTimersByTime(3000);
        jest.advanceTimersByTime(1000);

        expect(toasts().length).toBe(0);
    });

    it('honours a custom delay', () => {
        showToastEvent('success', 'sfdl', 'Log downloaded', 8000);

        jest.advanceTimersByTime(4000);
        expect(toasts().length).toBe(1);

        jest.advanceTimersByTime(4000);
        jest.advanceTimersByTime(1000);
        expect(toasts().length).toBe(0);
    });
});
