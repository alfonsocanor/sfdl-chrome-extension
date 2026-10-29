import { confirmDialog, alertDialog, closeDialogs } from 'sfdl/utils';

function flushPromises() {
    return new Promise((resolve) => setTimeout(resolve, 0));
}

const openModal = () => document.body.querySelector('sfdl-modal');

describe('dialog', () => {
    it('confirmDialog opens a destructive question and settles true on confirm', async () => {
        const choice = confirmDialog({
            title: 'Delete?',
            message: 'For good.',
            confirmLabel: 'Delete'
        });
        const modal = openModal();

        expect(modal.title).toBe('Delete?');
        expect(modal.confirmLabel).toBe('Delete');
        expect(modal.cancelLabel).toBe('Cancel');
        expect(modal.variant).toBe('destructive');

        modal.dispatchEvent(new CustomEvent('confirm'));

        await expect(choice).resolves.toBe(true);
        expect(openModal()).toBeNull();
    });

    it('confirmDialog settles false on cancel', async () => {
        const choice = confirmDialog({ title: 'Delete?', message: '' });

        openModal().dispatchEvent(new CustomEvent('cancel'));

        await expect(choice).resolves.toBe(false);
    });

    it('alertDialog only tells, with one button to close it', async () => {
        const choice = alertDialog({ title: 'No way', message: 'Not allowed' });
        const modal = openModal();

        expect(modal.cancelLabel).toBeUndefined();
        expect(modal.confirmLabel).toBe('Close');
        expect(modal.variant).toBe('error');

        modal.dispatchEvent(new CustomEvent('confirm'));

        await expect(choice).resolves.toBe(true);
    });

    it('a new dialog takes the place of the one open', async () => {
        confirmDialog({ title: 'First', message: '' });
        confirmDialog({ title: 'Second', message: '' });
        await flushPromises();

        const modals = document.body.querySelectorAll('sfdl-modal');
        expect(modals.length).toBe(1);
        expect(modals[0].title).toBe('Second');

        closeDialogs();
        expect(openModal()).toBeNull();
    });
});
