<p align="center">  
	<img width="192" height="192" src="src/resources/sfdl.png">  
</p>
# sfdl

Boosts productivity during debugging process Apex log analysis

## Install as a unpacked extension?

- Clone this repository
- From terminal navigate to the folder you clone the respository and rung:
	- npm install
	- npx webpack
		- This command will create a folder called 'dist' that we will in the last step
- Install chrome https://www.google.com/chrome
- Go to chrome://extensions
- Activate Developer mode
- Click on Load unpackaged button
- Navigate to the repository cloned and select the folder dist

## Downloading logs

The log list offers three ways of getting logs out of the org:

- **One log at a time**: every row in the log list has a download icon on its right. It
  saves that single log as a plain `.log` file, no zip involved.
- **A selection of logs**: every row also has a checkbox. Tick the logs you care about
  and the button turns into `Download selected logs (n)`; the checkbox above the button
  ticks and unticks the whole list at once.
- **Every log**: with nothing ticked the button reads `Download all logs` and produces
  `sfdl-ApexLog.zip`, exactly as before.

Whatever you download always has the filters of the manipulation menu applied to it, so
the file you get on disk matches what you see in the console.

## Run the unit tests

```bash
npm install
npm run test:unit             # run every suite once
npm run test:unit:watch       # re-run the suites while you edit
npm run test:unit:coverage    # same, with a coverage report in ./coverage
```

The suites live next to the code they cover, in `__tests__` folders. `jest/setup.js`
provides the `chrome.*` extension APIs and the constructable stylesheet polyfill that
every suite needs, and `jest/lwcCoverageTransformer.js` adds the istanbul instrumentation
the LWC jest transformer does not ship with.

## Test the extension before publishing

1. Build a fresh `dist` folder:
   ```bash
   npm install
   npm run test:unit
   npx webpack
   ```
2. Load it in Chrome:
   - go to `chrome://extensions`
   - turn **Developer mode** on
   - click **Load unpacked** and select the `dist` folder
   - if the extension was already loaded, hit the **reload** icon on its card so Chrome
     picks up the new build
3. Log in to the Salesforce org you want to analyse in the same browser profile, then
   click the sfdl icon and **Launch sfdl Console Station**.
4. Walk through the checklist:
   - the org shows up in the picker and the log list fills in
   - clicking a log renders it in the editor with the log name in the header
   - the download icon on a single row saves one `.log` file
   - ticking rows turns the button into `Download selected logs (n)` and saves only
     what is ticked; the checkbox above the button ticks and unticks the whole list
   - `Download all logs` still produces `sfdl-ApexLog.zip`
   - the progress bar and its cancel button behave during a long download
5. Keep the service worker console open (`chrome://extensions` → **service worker**) and
   the console page devtools open while you do it: both should stay free of errors.

Downloads land wherever Chrome is configured to put them; check
`chrome://settings/downloads` if you cannot find the files.

## ![Built using lwc oss](https://developer.salesforce.com/docs/platform/lwc/guide/get-started-oss.html)
