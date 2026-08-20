import {
    clearLocalStorage,
    setKeyValueLocalStorage,
    getValueLocalStorage
} from 'sfdl/utils';

describe('localStorage helpers', () => {
    it('clears the chrome local storage', () => {
        clearLocalStorage();

        expect(chrome.storage.local.clear).toHaveBeenCalledTimes(1);
    });

    it('stores a value under the given key', () => {
        setKeyValueLocalStorage('isDownloadInProgress', true);

        expect(chrome.storage.local.set).toHaveBeenCalledWith({
            isDownloadInProgress: true
        });
    });

    it('reads back the value stored under the given key', async () => {
        chrome.storage.local.get.mockResolvedValue({
            isDownloadInProgress: true
        });

        const value = await getValueLocalStorage('isDownloadInProgress');

        expect(chrome.storage.local.get).toHaveBeenCalledWith(
            'isDownloadInProgress'
        );
        expect(value).toBe(true);
    });

    it('resolves to undefined when the key is not stored', async () => {
        chrome.storage.local.get.mockResolvedValue({});

        await expect(
            getValueLocalStorage('unknownKey')
        ).resolves.toBeUndefined();
    });
});
