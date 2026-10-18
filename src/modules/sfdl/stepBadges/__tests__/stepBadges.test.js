import {
    areStepBadgesDismissed,
    dismissStepBadges,
    onStepBadgesDismissed
} from 'sfdl/stepBadges';

describe('sfdl/stepBadges', () => {
    it('shows the numbers of the steps until they are closed', async () => {
        expect(await areStepBadgesDismissed()).toBe(false);
        expect(chrome.storage.local.get).toHaveBeenCalledWith(
            'stepBadgesDismissed'
        );
    });

    it('reads that they were closed from the storage of the extension', async () => {
        chrome.storage.local.get.mockResolvedValue({
            stepBadgesDismissed: true
        });

        expect(await areStepBadgesDismissed()).toBe(true);
    });

    it('shows them when the storage cannot be read', async () => {
        chrome.storage.local.get.mockRejectedValue(new Error('no storage'));

        expect(await areStepBadgesDismissed()).toBe(false);
    });

    it('stores the closing and tells every picker listening', () => {
        const listener = jest.fn();
        const stopListening = onStepBadgesDismissed(listener);

        dismissStepBadges();
        stopListening();
        dismissStepBadges();

        expect(chrome.storage.local.set).toHaveBeenCalledWith({
            stepBadgesDismissed: true
        });
        expect(listener).toHaveBeenCalledTimes(1);
    });
});
