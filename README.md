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

Pick the org at the top of the log list of the Debug Logs tab, next to the buttons that
query its logs again and filter that query, a click anywhere else closing the filter.
The list folds into a strip reading Log List. It then offers three ways of getting logs
out of the org:

- **One log at a time**: every row in the log list has a download icon on its right. It
  saves that single log as a plain `.log` file, no zip involved.
- **A selection of logs**: every row also has a checkbox. Tick the logs you care about
  and the button turns into `Download selected logs (n)`; the checkbox above the button
  ticks and unticks the whole list at once.
- **Every log**: with nothing ticked the button reads `Download all logs` and produces
  `sfdl-ApexLog.zip`, exactly as before.

Whatever you download always has the filter pills that are on applied to it, so
the file you get on disk matches what you see in the console.

## Deleting logs

Debug logs pile up until the org stops writing new ones, so the log list of Analyse
deletes them too, the same three ways it downloads them:

- **One log at a time**: every row has a trash icon next to its download icon. It
  deletes that log at once, without asking.
- **A selection of logs**: with logs ticked the button next to the download one reads
  `Delete selected logs (n)`.
- **Every log**: with nothing ticked it reads `Delete all logs` and deletes whatever
  the filter lists.

Deleting a selection or every log asks first, in a dialog, since Salesforce keeps no
copy of a deleted debug log. The logs go two hundred at a time with a bar for the
progress, and the rows go as the org confirms them. A user without the Modify All Data
permission gets a dialog saying the logs cannot be deleted from here, nothing else
changes.

## Loading

While something loads, a stencil drawn in its shape stands in its place rather than a
spinner: the rows of a log list, the components of a type, the lines of a log or the two
panes of a diff. `sfdl-loading-stencil` holds one template per shape, picked by its
`type`, each one copying the measures of what it stands for.

## Comparing logs

Comparing logs lives in the **Debug Logs** tab, next to reading them. The toggle at the
top of the tab switches between **Analyse** and **Compare logs**, and Compare logs
between **Same org** and **Two orgs**. Each keeps what it had on screen while another
one is open. Whatever comes only from the left log shows in light blue, whatever comes
only from the right log in light amber.

- **Same org**: one list of the logs of an org, the org of the log list to start with.
  Tick two logs to compare them, the first on the left. A new tick replaces the log
  ticked last, so the other one stays to compare against; a ticked log ticked again
  comes off. The arrow keys walk the list the same way, past the log compared against.
  In Analyse, ticking two logs and clicking `compare side by side` opens them here, the
  older one on the left, the way an editor opens the diff of two files in a view of its
  own, and Analyse keeps the log it shows.
- **Two orgs**: four columns, the logs of the left org, the left log, the right log and
  the logs of the right org. Each side picks its own org at the top of its column, the
  border of the picker in the colour of its side and its name on hover. The left one
  starts on the org of the log list, and an org picked on one side is not offered on
  the other. Click a log to compare it on its side, or walk a list with the arrow keys
  to compare each log against the other side as you go. Both lists filter by any word
  of the log name and fold away.

Switching between Analyse and Compare logs, the org picker does not jump between its
two widths: the buttons of Analyse grow in while its picker shrinks to make room, and
the picker of the comparison grows to the whole width of its panel.

A new log on one side only reloads that side, the other one stays on screen. Each org
picker still to fill carries the number of its step on its corner, in light green, the next
one pulsing, an X on hover hiding them for good until the storage of the extension is
cleared, and so does the metadata picker of Compare Metadata. A long
list rises a `Back to the top` at the foot of its panel once scrolled half a panel down.

The filters of a log are pills, outlined in blue on a light blue fill while on, each
explained on hover. Analyse shows
them next to the name of the log, once the log list has an org; until then the pane
of the log only asks for one, `Pick the org of the logs.`:

- **Indent calls** indents each line by how deep it runs, method, constructor, flow and
  code unit entries stepping in and their exits stepping back out.
- **Hide heap and statements** hides the `HEAP_ALLOCATE` and `STATEMENT_EXECUTE` lines.
- **Hide flow noise** hides the flow lines about creating and finishing interviews and
  their limit usage, the flow elements themselves stay.

A comparison shows them in a row above the diff, with three more that only make sense
between two logs, so two runs of the same transaction do not differ on every line:

- **Ignore times** drops the time and nanoseconds that open each line.
- **Ignore record Ids** turns ids into their key prefix followed by `<id>`, so
  `001xx000003DGbYAAW` reads `001<id>`, and `0x7d7d4e32` into `0x<address>`.
- **Ignore line numbers**, off by default, for logs of code that moved.

The bar above the diff counts the differences, walks them with the chevrons and switches
to a single column or to ignoring whitespace.

A log body is downloaded once and kept while the console is open.

## Comparing metadata

The **Compare Metadata** tab compares the metadata of two orgs. Pick the left org on the
left and the right org on the right, an org picked on one side is not offered on the
other, then pick what to compare at the top of the Components column:

| Group | Types |
| --- | --- |
| Code | Apex Classes, Apex Triggers, Visualforce Pages, Visualforce Components |
| User interface | Lightning Web Components, Aura Components, Lightning Pages, Page Layouts, Static Resources |
| Data model | Custom Objects, Standard Objects, Custom Settings, Custom Metadata Records, Global Value Sets |
| Automation | Flows, Workflow Rules |
| Configuration | Custom Labels, Custom Permissions, Remote Site Settings, Named Credentials |

Nothing is retrieved until you ask for it, so a big org is never retrieved whole:

1. Picking a type lists the names both orgs hold, one call per org (`listMetadata`, or
   `describeGlobal` for custom settings). Every component reads **In both**, **Only
   left** or **Only right**, and its tooltip says when and by whom each org last
   changed it. Components of managed packages are left out.
2. Clicking a component retrieves that one component from both orgs, or from the one
   org that holds it, and opens its first difference.
3. A compared component reads **Different** or **Identical** and lists its files.
   Objects are split the way sfdx splits them, so `Account` lists
   `fields/Tier__c.field` and each validation rule, record type and list view on its
   own. Workflows split into their rules and actions, and every custom label is its own
   component.

When everything compared is identical the panel says so on top and still lists the
files. There is no refresh to remember: picking a type lists both orgs again, and a
component retrieved before is reused only while the org still gives it the same last
modified date, so anything changed since is retrieved again. The status of a retrieve
is checked less and less often, from every two seconds up to every ten, since every
check is an api request of the org.

Custom settings are read through REST rather than the Metadata API, since their values
are data: each one is written out with its fields and every value, the org default,
then the profiles and the users by name, so a different endpoint or switch shows up as
a line of the diff. Their values change without a trace in the listing, so they are
read again every time they are compared.

Profiles and permission sets are left out on purpose: retrieved on their own they only
carry the permissions of the other components of the same retrieve, so comparing them
would report differences that are not there.

## Monitoring

The **Monitoring** tab is for what Setup spreads over Apex Jobs, Scheduled Jobs,
Debug Logs, Paused Flow Interviews, Platform Events, Login History, the Setup Audit
Trail, Event Monitoring, Transaction Security and Company Information: how the org is
doing, in one place. Pick an org at the top and every monitor loads on its own,
a card per monitor under the title of its section: a figure, what the figure is counted
out of and whether it needs a look, or an overview when it is there to be known. The
limits have a panel of their own on the right, so their loading never moves the cards.
Click a
card for the detail behind it: its items counted by day, by user, by class or by
whatever breakdown the monitor offers, as bars, then listed in a table. Click a bar,
or a day, to list its items only, and again to list them all. A filter above the table
keeps the rows with what is typed in any of their cells. `Copy` puts the rows listed on
the clipboard as they read, a tab between the cells, ready to paste into a spreadsheet,
and `Download CSV` saves them. A long list draws its first 200 rows with a link for more. A long message
is cut short in its cell, a `more` at its foot shows the whole of it, wrapped, and a
`less` folds it again. The refresh button reads the org again.

The tab reads the org only when an org is picked and on the refresh, never on its own.
One read costs about 30 API requests, up to about 70 when the event log cards have files
to download, a few hundredths of a percent of an org's daily API requests.

Every word of the tab can be selected and copied, the errors of a card too: a click
that ends a selection does not open the card or pick the bar under it.

A monitor whose feature the org does not have, Threat Detection without Shield or a
policy without the Event Monitoring add-on, says what it needs on a grey card instead of
failing.

**Limits at the moment**, the panel on the right: every limit the org reports, in
words, the most used first, each with how much is used of its maximum and a meter, red
from eighty percent on: API requests, async Apex executions, platform events published
this hour and delivered today, streaming clients, bulk jobs, emails, storage and the
rest. The limits with nothing used stay behind a `Show the n limits not used` link, and
the panel folds into a strip like the panels of the other tabs. A filter at the top
finds a limit by its words, its API name or what else it goes by, `db` or `records` for
the data storage, `cometd` for the streaming clients, and a letter or two mistyped,
missing or swapped is fine: `dta strage` and `estorage` both find `Data storage, MB`.
The matching lives in `sfdl/fuzzySearch`, for any other list to use.

**Security and access**:

- **Failed logins**: the logins of the last seven days that did not succeed and why,
  out of every login of the Login History. A user or an IP failing five times or more
  is marked, and makes the card one to look at. The Login History cannot filter on its
  status, so the latest 10,000 logins are read and the failed ones kept; the caption
  says so when the org had more.
- **Setup changes**: what the Setup Audit Trail recorded in the last seven days, by
  user, section and action. A change made through Login-As is marked with who really
  made it.
- **Threats detected**: what Threat Detection caught in the last thirty days, sessions
  hijacked, credential stuffing, report and API anomalies, each with its score and what
  it saw. It comes with Shield or the Event Monitoring add-on.
- **Transaction security policies**: the policies of the org, the event each one
  watches, written in Apex or with the condition builder, enabled or not. `Enable` and
  `Disable` on each row change it after asking; the policies are written in Setup.

**Real-time events**:

- **Event Manager**: the real-time event settings of the org, as the Event Manager of
  Setup lists them, the streaming and the storage of each event on or off. `Turn on` and
  `Turn off` change one after asking, through the Metadata API. An org without Shield or
  the Event Monitoring add-on may list only the login and logout streams.
- **Live events**: pick a platform event, a change event or a real-time stream of the
  org and `Start` listening: each event shows as it comes, the newest first, with its
  payload, up to the latest 500. `Copy all` copies them as the org sent them. The
  channel field takes a search: type any words of a channel's name, its API name or its
  kind, a mistyped letter forgiven, and `Enter` picks the first one left.

  `Stop after` picks how long one listening lasts: 5, 15 or 30 minutes, 1 hour or 2
  hours, 30 minutes unless picked otherwise. Two hours is the most, as long as the
  default session of an org lasts, so a listening left open is never forgotten. It also
  stops on `Stop`, the way back to the cards, another org picked, the tab closed or the
  session over. Only what happens from the start on is heard.

  What a listening costs the org:

  - It holds one long poll open at a time, up to about two minutes each, then the next,
    and takes one of the org's concurrent streaming clients while it listens: 2,000 on
    Unlimited and Performance, 1,000 on Enterprise, 20 on the rest.
  - Each platform event or change event it hears counts toward the event deliveries of
    the org in a rolling 24 hours, shared with the org's own subscribers: 50,000 on
    Unlimited and Performance, 25,000 on Enterprise, 10,000 on Developer Edition, more
    with the add-on. Before it starts it reads how much is used, shows it, and listens
    for a tenth of what is left at most and never more than 1,000 events, then stops by
    itself. With most of it used it asks first, with nearly none left it does not start.
    When the org reports no delivery limit, the 1,000 hold.
  - Real-time streams count toward no delivery, so only their time stops them.
  - The streaming calls did not show in the org's API requests when measured on a
    sandbox. Starting on a platform or change event reads the limits of the org, one
    API request.
  - It publishes nothing and changes nothing in the org.

**Apex and jobs**:

- **Failed debug logs**: the debug logs whose status is not Success, the exception
  their request ended in, out of every log of the org.
- **Failed async jobs**: the batch, queueable, future and scheduled Apex that failed or
  had errors in the last seven days, with the message of the failure.
- **Scheduled jobs in error**: the scheduled jobs whose trigger is in error or blocked,
  listed with every other job scheduled in the org.

**Event log files**, read out of the daily CSV files of Event Monitoring: the last week
of them, up to 20 MB per card, so opening the tab never pulls a busy org's whole week of
logs. A card says when it left files out for their size, and when the org has no file of
its type. The fields of the files are asked of each org first: one without the add-on
has no hourly files, nor the fields that tell them apart.

- **Log files to download**: every event log file of the last seven days, of every
  type, daily and hourly, each with a `Download` button that saves its CSV as it is.
- **API calls by client**: out of the API Total Usage files every org gets free, the
  calls of the last seven days added up per day, user, client, API and object, with the
  ones counted against the API limit and the ones that failed. It tells who uses up the
  API requests of the meter on the right.
- **Unhandled Apex exceptions**: every exception no code caught, whoever ran into it,
  with no trace flag needed, by exception, by where it was raised and by user.
- **Long running Apex**: the executions over five seconds, the ones that fill the limit
  of concurrent long running requests, by entry point and by the seconds they took.
- **Reports exported**: who exported which report, from which IP and with what.

The last three come with the Event Monitoring add-on. Without it the org has no file of
their type and their card says so.

**Platform events**:

- **Event subscribers in trouble**: every Apex trigger and client subscribed to a
  platform event or change event, with its lag behind the tip of the event bus, its
  retries and its last error; the suspended ones and the ones holding an error first.
- **Platform events defined**: the custom and standard events of the org and how many
  subscribe to each, so an event published for no one shows.
- **Events delivered**: what the event bus delivered and published in the last seven
  days, by day and by metric.

**Flows**:

- **Failed flow interviews**: the interviews that ended in error, out of every
  interview paused or waiting in the org. An error of a flow that was not paused is
  only emailed by Salesforce and published as an event, nothing a query reaches.
- **Flows with a newer draft**: every flow of the org by type, trigger and object, the
  ones whose latest version is not the active one first.

**Lightning pages**:

- **Slow Lightning pages**: the Lightning usage metrics of the last thirty days per
  page, its views, its users and its average effective page time, from the click to the
  page drawn. The pages over five seconds are marked.

Left to Salesforce: the dashboards of the Event Monitoring Analytics app. The breakdowns
of each detail, by day, by user and the rest, with a bar picked to list its rows, are
what this tab offers in their place.

A monitor is an entry of `sfdl/monitors`: its section, what it loads, how it sums up,
how its detail lists and counts its items, what the org needs for it and the actions of
its rows, and whether it opens on the list or on the live view. A monitor of an event
type is the type and how its rows become items, the reading of the files lives in
`sfdl/eventLogFiles` and the CSV in `sfdl/csv`. The live view listens through
`sfdl/streaming`, a CometD client of the Streaming API. The sections, the meters, the cards and
the detail draw whatever that catalogue lists, so adding a monitor is adding an entry.

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
   - the org shows up in the picker at the top of the log list and the list fills in
   - clicking a log renders it in the editor with the log name in the header
   - the download icon on a single row saves one `.log` file
   - ticking rows turns the button into `Download selected logs (n)` and saves only
     what is ticked; the checkbox above the button ticks and unticks the whole list
   - `Download all logs` still produces `sfdl-ApexLog.zip`
   - the progress bar and its cancel button behave during a long download
   - Debug Logs, Analyse: ticking two logs offers `compare side by side`, which opens
     them in Compare logs, Same org, and Analyse still shows its log when you go back
   - Debug Logs, Compare logs, Same org: a third tick replaces the last one, the first
     stays on the left and only the right side reloads
   - Debug Logs, Compare logs, Two orgs: each side lists the logs of its own org, the org of
     one side is not offered on the other, the timestamp and id filters make two runs
     of the same transaction differ only where they really do
   - Compare Metadata: picking a type only lists names, opening a component compares
     it
   - Compare Metadata with Custom Objects: a changed field shows as its own file
5. Keep the service worker console open (`chrome://extensions` → **service worker**) and
   the console page devtools open while you do it: both should stay free of errors.

Downloads land wherever Chrome is configured to put them; check
`chrome://settings/downloads` if you cannot find the files.

## ![Built using lwc oss](https://developer.salesforce.com/docs/platform/lwc/guide/get-started-oss.html)
