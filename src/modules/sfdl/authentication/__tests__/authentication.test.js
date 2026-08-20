import {
    getAllCookiesFromSalesforceDomain,
    isSessionInformationValid
} from 'sfdl/authentication';

const COOKIE = { domain: 'acme.my.salesforce.com', value: 'a-session-id' };

describe('authentication', () => {
    describe('getAllCookiesFromSalesforceDomain', () => {
        it('asks chrome for the secure sid cookies of the salesforce domain', async () => {
            chrome.cookies.getAll.mockResolvedValue([COOKIE]);

            await expect(getAllCookiesFromSalesforceDomain()).resolves.toEqual([
                COOKIE
            ]);
            expect(chrome.cookies.getAll).toHaveBeenCalledWith({
                name: 'sid',
                domain: 'salesforce.com',
                secure: true
            });
        });
    });

    describe('isSessionInformationValid', () => {
        it('accepts a session the tooling api answers with a 200', async () => {
            global.fetch = jest.fn(() => Promise.resolve({ status: 200 }));

            await expect(isSessionInformationValid(COOKIE)).resolves.toBe(true);
            expect(global.fetch.mock.calls[0][0]).toContain(
                'https://acme.my.salesforce.com/services/data/v51.0/tooling/query/'
            );
            expect(global.fetch.mock.calls[0][1].headers.Authorization).toBe(
                'Bearer a-session-id'
            );
        });

        it('rejects a session the tooling api refuses', async () => {
            global.fetch = jest.fn(() => Promise.resolve({ status: 401 }));

            await expect(isSessionInformationValid(COOKIE)).resolves.toBe(
                false
            );
        });

        it('rejects a session when the org is unreachable', async () => {
            global.fetch = jest.fn(() =>
                Promise.reject(new Error('network down'))
            );

            await expect(isSessionInformationValid(COOKIE)).resolves.toBe(
                false
            );
        });
    });
});
