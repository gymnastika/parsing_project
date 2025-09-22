# Apify API client for JavaScript

View as MarkdownCopy for LLM

`apify-client` is the official library to access the [Apify REST API](https://docs.apify.com/api/v2) from your JavaScript/TypeScript applications. It runs both in Node.js and browser and provides useful features like automatic retries and convenience functions that improve the experience of using the Apify API. All requests and responses (including errors) are encoded in JSON format with UTF-8 encoding.

## Pre-requisites[​](#pre-requisites "Direct link to heading")

`apify-client` requires Node.js version 16 or higher. Node.js is available for download on the [official website](https://nodejs.org/). Check for your current node version by running:

```
node -v
```

## Installation[​](#installation "Direct link to heading")

You can install the client via [NPM](https://www.npmjs.com/) or use any other package manager of your choice.

* NPM
* Yarn
* PNPM
* Bun

```
npm i apify-client
```

```
yarn add apify-client
```

```
pnpm add apify-client
```

```
bun add apify-client
```

## Authentication and Initialization[​](#authentication-and-initialization "Direct link to heading")

To use the client, you need an [API token](https://docs.apify.com/platform/integrations/api#api-token). You can find your token under [Integrations](https://console.apify.com/account/integrations) tab in Apify Console. Copy the token and initialize the client by providing the token (`MY-APIFY-TOKEN`) as a parameter to the `ApifyClient` constructor.

```
// import Apify client
import { ApifyClient } from 'apify-client';

// Client initialization with the API token
const client = new ApifyClient({
    token: 'MY-APIFY-TOKEN',
});
```

Secure access

The API token is used to authorize your requests to the Apify API. You can be charged for the usage of the underlying services, so do not share your API token with untrusted parties or expose it on the client side of your applications

## Quick start[​](#quick-start "Direct link to heading")

One of the most common use cases is starting [Actors](https://docs.apify.com/platform/actors) (serverless programs running in the [Apify cloud](https://docs.apify.com/platform)) and getting results from their [datasets](https://docs.apify.com/platform/storage/dataset) (storage) after they finish the job (usually scraping, automation processes or data processing).

```
import { ApifyClient } from 'apify-client';

const client = new ApifyClient({ token: 'MY-APIFY-TOKEN' });

// Starts an Actor and waits for it to finish
const { defaultDatasetId } = await client.actor('username/actor-name').call();

// Lists items from the Actor's dataset
const { items } = await client.dataset(defaultDatasetId).listItems();
```

### Running Actors[​](#running-actors "Direct link to heading")

To start an Actor, you can use the [ActorClient](https://docs.apify.com/api/client/js/api/client/js/reference/class/ActorClient.md) (`client.actor()`) and pass the Actor's ID (e.g. `john-doe/my-cool-actor`) to define which Actor you want to run. The Actor's ID is a combination of the username and the Actor owner’s username. You can run both your own Actors and [Actors from Apify Store](https://docs.apify.com/platform/actors/running/actors-in-store).

#### Passing input to the Actor[​](#passing-input-to-the-actor "Direct link to heading")

To define the Actor's input, you can pass an object to the [`call()`](https://docs.apify.com/api/client/js/api/client/js/reference/class/ActorClient.md#call) method. The input object can be any JSON object that the Actor expects (respects the Actor's [input schema](https://docs.apify.com/platform/actors/development/actor-definition/input-schema)). The input object is used to pass configuration to the Actor, such as URLs to scrape, search terms, or any other data.

```
import { ApifyClient } from 'apify-client';

const client = new ApifyClient({ token: 'MY-APIFY-TOKEN' });

// Runs an Actor with an input and waits for it to finish.
const { defaultDatasetId } = await client.actor('username/actor-name').call({
    some: 'input',
});
```

### Getting results from the dataset[​](#getting-results-from-the-dataset "Direct link to heading")

To get the results from the dataset, you can use the [DatasetClient](https://docs.apify.com/api/client/js/api/client/js/reference/class/DatasetClient.md) (`client.dataset()`) and [`listItems()`](https://docs.apify.com/api/client/js/api/client/js/reference/class/DatasetClient.md#listItems) method. You need to pass the dataset ID to define which dataset you want to access. You can get the dataset ID from the Actor's run object (represented by `defaultDatasetId`).

```
import { ApifyClient } from 'apify-client';

const client = new ApifyClient({ token: 'MY-APIFY-TOKEN' });

// Lists items from the Actor's dataset.
const { items } = await client.dataset('dataset-id').listItems();
```

Dataset access

Running an Actor might take time, depending on the Actor's complexity and the amount of data it processes. If you want only to get data and have an immediate response you should access the existing dataset of the finished [Actor run](https://docs.apify.com/platform/actors/running/runs-and-builds#runs).

## Usage concepts[​](#usage-concepts "Direct link to heading")

The `ApifyClient` interface follows a generic pattern that applies to all of its components. By calling individual methods of `ApifyClient`, specific clients that target individual API resources are created. There are two types of those clients:

* [`actorClient`](https://docs.apify.com/api/client/js/api/client/js/reference/class/ActorClient.md): a client for the management of a single resource
* [`actorCollectionClient`](https://docs.apify.com/api/client/js/api/client/js/reference/class/ActorCollectionClient.md): a client for the collection of resources

```
import { ApifyClient } from 'apify-client';

const client = new ApifyClient({ token: 'MY-APIFY-TOKEN' });

// Collection clients do not require a parameter.
const actorCollectionClient = client.actors();
// Creates an actor with the name: my-actor.
const myActor = await actorCollectionClient.create({ name: 'my-actor-name' });
// List all your used Actors (both own and from Apify Store)
const { items } = await actorCollectionClient.list();
```

Resource identification

The resource ID can be either the `id` of the said resource, or a combination of your `username/resource-name`.

```
import { ApifyClient } from 'apify-client';

const client = new ApifyClient({ token: 'MY-APIFY-TOKEN' });

// Resource clients accept an ID of the resource.
const actorClient = client.actor('username/actor-name');
// Fetches the john-doe/my-actor object from the API.
const myActor = await actorClient.get();
// Starts the run of john-doe/my-actor and returns the Run object.
const myActorRun = await actorClient.start();
```

### Nested clients[​](#nested-clients "Direct link to heading")

Sometimes clients return other clients. That's to simplify working with nested collections, such as runs of a given Actor.

```
import { ApifyClient } from 'apify-client';

const client = new ApifyClient({ token: 'MY-APIFY-TOKEN' });

const actorClient = client.actor('username/actor-name');
const runsClient = actorClient.runs();
// Lists the last 10 runs of your Actor.
const { items } = await runsClient.list({
    limit: 10,
    desc: true,
});

// Select the last run of your Actor that finished
// with a SUCCEEDED status.
const lastSucceededRunClient = actorClient.lastRun({ status: 'SUCCEEDED' });
// Fetches items from the run's dataset.
const { items } = await lastSucceededRunClient.dataset().listItems();
```

The quick access to `dataset` and other storage directly from the run client can be used with the [`lastRun()`](https://docs.apify.com/api/client/js/api/client/js/reference/class/ActorClient.md#lastRun) method.

## Features[​](#features "Direct link to heading")

Based on the endpoint, the client automatically extracts the relevant data and returns it in the expected format. Date strings are automatically converted to `Date` objects. For exceptions, the client throws an [`ApifyApiError`](https://docs.apify.com/api/client/js/api/client/js/reference/class/ApifyApiError.md), which wraps the plain JSON errors returned by API and enriches them with other contexts for easier debugging.

```
import { ApifyClient } from 'apify-client';

const client = new ApifyClient({ token: 'MY-APIFY-TOKEN' });

try {
    const { items } = await client.dataset('non-existing-dataset-id').listItems();
} catch (error) {
    // The error is an instance of ApifyApiError
    const { message, type, statusCode, clientMethod, path } = error;
    // Log error for easier debugging
    console.log({ message, statusCode, clientMethod, type });
}
```

### Retries with exponential backoff[​](#retries-with-exponential-backoff "Direct link to heading")

Network communication sometimes fails. That's a given. The client will automatically retry requests that failed due to a network error, an internal error of the Apify API (HTTP 500+), or a rate limit error (HTTP 429). By default, it will retry up to 8 times. The first retry will be attempted after \~500ms, the second after \~1000ms, and so on. You can configure those parameters using the `maxRetries` and `minDelayBetweenRetriesMillis` options of the `ApifyClient` constructor.

```
import { ApifyClient } from 'apify-client';

const client = new ApifyClient({
    token: 'MY-APIFY-TOKEN',
    maxRetries: 8,
    minDelayBetweenRetriesMillis: 500, // 0.5s
    timeoutSecs: 360, // 6 mins
});
```

### Convenience functions and options[​](#convenience-functions-and-options "Direct link to heading")

Some actions can't be performed by the API itself, such as indefinite waiting for an Actor run to finish (because of network timeouts). The client provides convenient `call()` and `waitForFinish()` functions that do that. If the limit is reached, the returned promise is resolved to a run object that will have status `READY` or `RUNNING` and it will not contain the Actor run output.

[Key-value store](https://docs.apify.com/platform/storage/key-value-store) records can be retrieved as objects, buffers, or streams via the respective options, dataset items can be fetched as individual objects or serialized data.

```
import { ApifyClient } from 'apify-client';

const client = new ApifyClient({ token: 'MY-APIFY-TOKEN' });

// Starts an Actor and waits for it to finish.
const finishedActorRun = await client.actor('username/actor-name').call();

// Starts an Actor and waits maximum 60s for the finish
const { status } = await client.actor('username/actor-name').start({
    waitForFinish: 60, // 1 minute
});
```

### Pagination[​](#pagination "Direct link to heading")

Most methods named `list` or `listSomething` return a [`Promise<PaginatedList>`](https://docs.apify.com/api/client/js/api/client/js/reference/interface/PaginatedList.md). There are some exceptions though, like `listKeys` or `listHead` which paginate differently. The results you're looking for are always stored under `items` and you can use the `limit` property to get only a subset of results. Other props are also available, depending on the method.

```
import { ApifyClient } from 'apify-client';

const client = new ApifyClient({ token: 'MY-APIFY-TOKEN' });

// Resource clients accept an ID of the resource.
const datasetClient = client.dataset('dataset-id');

// Number of items per page
const limit = 1000;
// Initial offset
let offset = 0;
// Array to store all items
let allItems = [];

while (true) {
    const { items, total } = await datasetClient.listItems({ limit, offset });

    console.log(`Fetched ${items.length} items`);

    // Merge new items with other already loaded items
    allItems.push(...items);

    // If there are no more items to fetch, exit the loading
    if (offset + limit >= total) {
        break;
    }

    offset += limit;
}

console.log(`Overall fetched ${allItems.length} items`);
```
# Code examples

View as MarkdownCopy for LLM

## Passing an input to the Actor[​](#passing-an-input-to-the-actor "Direct link to heading")

The fastest way to get results from an Actor is to pass input directly to the `call` function. Input can be passed to `call` function and the reference of running Actor (or wait for finish) is available in `runData` variable.

This example starts an Actor that scrapes 20 posts from the Instagram website based on the hashtag.

```
import { ApifyClient } from 'apify-client';

// Client initialization with the API token
const client = new ApifyClient({ token: 'MY_APIFY_TOKEN' });

const actorClient = client.actor('apify/instagram-hashtag-scraper');

const input = { hashtags: ['rainbow'], resultsLimit: 20 };

// Run the Actor and wait for it to finish up to 60 seconds.
// Input is not persisted for next runs.
const runData = await actorClient.call(input, { waitSecs: 60 });

console.log('Run data:');
console.log(runData);
```

To run multiple inputs with the same Actor, most convenient way is to create multiple [tasks](https://docs.apify.com/platform/actors/running/tasks) with different inputs. Task input is persisted on Apify platform when task is created.

```
import { ApifyClient } from 'apify-client';

// Client initialization with the API token
const client = new ApifyClient({ token: 'MY_APIFY_TOKEN' });

const animalsHashtags = ['zebra', 'lion', 'hippo'];

// Multiple input schemas for one Actor can be persisted in tasks.
// Tasks are saved in the Apify platform and can be run multiple times.
const socialsTasksPromises = animalsHashtags.map((hashtag) =>
    client.tasks().create({
        actId: 'apify/instagram-hashtag-scraper',
        name: `hashtags-${hashtag}`,
        input: { hashtags: [hashtag], resultsLimit: 20 },
        options: { memoryMbytes: 1024 },
    }),
);

// Create all tasks in parallel
const createdTasks = await Promise.all(socialsTasksPromises);

console.log('Created tasks:');
console.log(createdTasks);

// Run all tasks in parallel
await Promise.all(createdTasks.map((task) => client.task(task.id).call()));
```

## Getting latest data from an Actor, joining datasets[​](#getting-latest-data-from-an-actor-joining-datasets "Direct link to heading")

Actor data are stored to [datasets](https://docs.apify.com/platform/storage/dataset). Datasets can be retrieved from Actor runs. Dataset items can be listed with pagination. Also, datasets can be merged together to make analysis further on with single file as dataset can be exported to various data format (CSV, JSON, XSLX, XML). [Integrations](https://docs.apify.com/platform/integrations) can do the trick as well.

```
import { ApifyClient } from 'apify-client';

// Client initialization with the API token
const client = new ApifyClient({ token: 'MY_APIFY_TOKEN' });

const actorClient = client.actor('apify/instagram-hashtag-scraper');

const actorRuns = actorClient.runs();

// See pagination to understand how to get more datasets
const actorDatasets = await actorRuns.list({ limit: 20 });

console.log('Actor datasets:');
console.log(actorDatasets);

const mergingDataset = await client.datasets().getOrCreate('merge-dataset');

for (const datasetItem of actorDatasets.items) {
    // Dataset items can be handled here. Dataset items can be paginated
    const datasetItems = await client.dataset(datasetItem.defaultDatasetId).listItems({ limit: 1000 });

    // Items can be pushed to single dataset
    await client.dataset(mergingDataset.id).pushItems(datasetItems.items);

    // ...
}
```

## Handling webhooks[​](#handling-webhooks "Direct link to heading")

[Webhooks](https://docs.apify.com/platform/integrations/webhooks) can be used to get notifications about Actor runs. For example, a webhook can be triggered when an Actor run finishes successfully. Webhook can receive dataset ID for further processing.

Initialization of webhook:

```
import { ApifyClient } from 'apify-client';

// Client initialization with the API token
const client = new ApifyClient({ token: 'MY_APIFY_TOKEN' });

const webhooksClient = client.webhooks();

await webhooksClient.create({
    description: 'Instagram hashtag actor succeeded',
    condition: { actorId: 'reGe1ST3OBgYZSsZJ' }, // Actor ID of apify/instagram-hashtag-scraper
    // Request URL can be generated using https://webhook.site. Any REST server can be used
    requestUrl: 'https://webhook.site/CUSTOM_WEBHOOK_ID',
    eventTypes: ['ACTOR.RUN.SUCCEEDED'],
});
```

Simple webhook listener can be built on [`express`](https://expressjs.com/) library, which can helps to create a REST server for handling webhooks:

```
import express from 'express';
import bodyParser from 'body-parser';
import { ApifyClient, DownloadItemsFormat } from 'apify-client';

// Initialize Apify client, express and define server port
const client = new ApifyClient({ token: 'MY_APIFY_TOKEN' });
const app = express();
const PORT = 3000;

// Tell express to use body-parser's JSON parsing
app.use(bodyParser.json());

app.post('apify-webhook', async (req, res) => {
    // Log the payload from the webhook
    console.log(req.body);

    const runDataset = await client.dataset(req.body.resource.defaultDatasetId);

    // e.g. Save dataset locally as JSON
    await runDataset.downloadItems(DownloadItemsFormat.JSON);

    // Respond to the webhook
    res.send('Webhook received');
});

// Start express on the defined port
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
```

API clients

import { ApifyClient } from 'apify-client';

// Initialize the ApifyClient with API token
const client = new ApifyClient({
    token: '<YOUR_API_TOKEN>',
});

// Prepare Actor input
const input = {
    "searchStringsArray": [
        "restaurant"
    ],
    "locationQuery": "New York, USA",
    "maxCrawledPlacesPerSearch": 50,
    "language": "en",
    "searchMatching": "all",
    "placeMinimumStars": "",
    "website": "allPlaces",
    "skipClosedPlaces": false,
    "scrapePlaceDetailPage": false,
    "scrapeTableReservationProvider": false,
    "includeWebResults": false,
    "scrapeDirectories": false,
    "maxQuestions": 0,
    "scrapeContacts": false,
    "maximumLeadsEnrichmentRecords": 0,
    "maxReviews": 0,
    "reviewsSort": "newest",
    "reviewsFilterString": "",
    "reviewsOrigin": "all",
    "scrapeReviewsPersonalData": true,
    "scrapeImageAuthors": false,
    "allPlacesNoSearchAction": ""
};

(async () => {
    // Run the Actor and wait for it to finish
    const run = await client.actor("nwua9Gu5YrADL7ZDj").call(input);

    // Fetch and print Actor results from the run's dataset (if any)
    console.log('Results from dataset');
    const { items } = await client.dataset(run.defaultDatasetId).listItems();
    items.forEach((item) => {
        console.dir(item);
    });
})();

API

API token
Default API token created on sign up.

Manage tokens
List of most relevant API endpoints. See API reference for full details.
The URLs below contain your API token. Don't share them with untrusted parties.
Run Actor
View API reference
Runs this Actor. The POST payload including its Content-Type header is passed as INPUT to the Actor (typically application/json). The Actor is started with the default options; you can override them using various URL query parameters.

POST
https://api.apify.com/v2/acts/compass~crawler-google-places/runs?token=***



Test endpoint

Hint: By adding the method=POST query parameter, this API endpoint can be called using a GET request and thus used in third-party webhooks.

Run Actor synchronously and get a key-value store record
View API reference
Runs this Actor and waits for it to finish. The POST payload, including its Content-Type, is passed as Actor input. The OUTPUT record (or any other specified with the outputRecordKey query parameter) from the default key-value store is returned as the HTTP response. The Actor is started with the default options; you can override them using various URL query parameters. Note that long HTTP connections might break.

POST
https://api.apify.com/v2/acts/compass~crawler-google-places/run-sync?token=***



Test endpoint

Hint: This endpoint can be used with both POST and GET request methods, but only the POST method allows you to pass input.

Run Actor synchronously and get dataset items
View API reference
Runs this Actor and waits for it to finish. The POST payload including its Content-Type header is passed as INPUT to the Actor (usually application/json). The HTTP response contains the Actor's dataset items, while the format of items depends on specifying dataset items' format parameter.

POST
https://api.apify.com/v2/acts/compass~crawler-google-places/run-sync-get-dataset-items?token=***



Test endpoint

Hint: This endpoint can be used with both POST and GET request methods, but only the POST method allows you to pass input.

Get Actor
View API reference
Returns settings of this Actor in JSON format.

GET
https://api.apify.com/v2/acts/compass~crawler-google-places?token=***



Test endpoint

Get list of Actor versions
View API reference
Returns a list of versions of this Actor in JSON format.

GET
https://api.apify.com/v2/acts/compass~crawler-google-places/versions?token=***



Test endpoint

Get list of Actor webhooks
View API reference
Returns a list of webhooks of this Actor in JSON format.

GET
https://api.apify.com/v2/acts/compass~crawler-google-places/webhooks?token=***



Test endpoint

Update Actor
View API reference
Updates settings of this Actor. The POST payload must be a JSON object with fields to update.

PUT
https://api.apify.com/v2/acts/compass~crawler-google-places?token=***


Update Actor version
View API reference
Updates version of this Actor. Replace the 0.0 with the updating version number. The POST payload must be a JSON object with fields to update.

PUT
https://api.apify.com/v2/acts/compass~crawler-google-places/versions/0.0?token=***


Delete Actor
View API reference
Deletes this Actor and all associated data.

DELETE
https://api.apify.com/v2/acts/compass~crawler-google-places?token=***


Get list of builds
View API reference
Returns a list of builds of this Actor in JSON format.

GET
https://api.apify.com/v2/acts/compass~crawler-google-places/builds?token=***



Test endpoint

Build Actor
View API reference
Builds a specific version of this Actor and returns information about the build. Replace the 0.0 parameter with the desired version number.

POST
https://api.apify.com/v2/acts/compass~crawler-google-places/builds?token=***&version=0.0


Hint: By adding the method=POST query parameter, this API endpoint can be called using a GET request and thus used in third-party webhooks.

Get list of runs
View API reference
Returns a list of runs of this Actor in JSON format.

GET
https://api.apify.com/v2/acts/compass~crawler-google-places/runs?token=***



Test endpoint

Get last run
View API reference
Returns the last run of this Actor in JSON format.

GET
https://api.apify.com/v2/acts/compass~crawler-google-places/runs/last?token=***



Test endpoint

Hint: Add the status=SUCCEEDED query parameter to only get the last successful run of the Actor.

Get last run dataset items
View API reference
Returns data from the default dataset of the last run of this Actor in JSON format.

GET
https://api.apify.com/v2/acts/compass~crawler-google-places/runs/last/dataset/items?token=***



Test endpoint

Hint: Add the status=SUCCEEDED query parameter to only get the last successful run of the Actor. This API endpoint supports all the parameters of the Dataset Get Items endpoint.

Get OpenAPI definition
View API reference
Returns the OpenAPI definition for the Actor's default build with information on how to run this Actor build using the API.

GET
https://api.apify.com/v2/acts/compass~crawler-google-places/builds/default/openapi.json


Test endpoint

Run from CLI

Install Apify CLI
Using Homebrew:

brew install apify-cli

Using NPM:

npm install -g apify-cli

Having problems? Read the installation guide
Log in to Apify
You will need to provide your Apify API token to complete this action.

apify login

Run this Actor from the command line
apify call nwua9Gu5YrADL7ZDj

Learn more about Apify CLI

# Apify CLI Reference Documentation

View as MarkdownCopy for LLM

The Apify CLI provides tools for managing your Apify projects and resources from the command line. Use these commands to develop Actors locally, deploy them to Apify platform, manage storage, orchestrate runs, and handle account configuration.

This reference guide documents available commands, their options, and common usage patterns, to efficiently work with Apify platform.

### General[​](#general "Direct link to heading")

The general commands provide basic functionality for getting help and information about the Apify CLI.

##### `apify help`[​](#apify-help "Direct link to heading")

```
DESCRIPTION
  Prints out help about a command, or all available commands.

USAGE
  $ apify help [commandString]

ARGUMENTS
  commandString  The command to get help for.
```

##### `apify upgrade`[​](#apify-upgrade "Direct link to heading")

```
DESCRIPTION
  Checks that installed Apify CLI version is up to date.

USAGE
  $ apify upgrade [-f] [--version <value>]

FLAGS
  -f, --force            [DEPRECATED] This flag is now
                         ignored, as running the command manually will always check
                         for the latest version.
      --version=<value>  The version of the CLI to upgrade to. If
                         not provided, the latest version will be used.
```

##### `apify telemetry`[​](#apify-telemetry "Direct link to heading")

```
DESCRIPTION
  Manages telemetry settings. We use this data to improve the CLI and the Apify
  platform.
  Read more: https://docs.apify.com/cli/docs/telemetry

SUBCOMMANDS
  telemetry enable   Enables telemetry.
  telemetry disable  Disables telemetry.
```

##### `apify telemetry enable`[​](#apify-telemetry-enable "Direct link to heading")

```
DESCRIPTION
  Enables telemetry.

USAGE
  $ apify telemetry enable
```

##### `apify telemetry disable`[​](#apify-telemetry-disable "Direct link to heading")

```
DESCRIPTION
  Disables telemetry.

USAGE
  $ apify telemetry disable
```

### Authentication & Account Management[​](#authentication--account-management "Direct link to heading")

Use these commands to manage your Apify account authentication, access tokens, and configuration settings. These commands control how you interact with Apify platform and manage sensitive information.

##### `apify login`[​](#apify-login "Direct link to heading")

```
DESCRIPTION
  Authenticates your Apify account and saves credentials to
  '~/.apify/auth.json'.
  All other commands use these stored credentials.

  Run 'apify logout' to remove authentication.

USAGE
  $ apify login [-m console|manual] [-t <value>]

FLAGS
  -m, --method=<option>  Method of logging in to Apify
                         <options: console|manual>
  -t, --token=<value>    Apify API token
```

##### `apify logout`[​](#apify-logout "Direct link to heading")

```
DESCRIPTION
  Removes authentication by deleting your API token and account information from
   '~/.apify/auth.json'.
  Run 'apify login' to authenticate again.

USAGE
  $ apify logout
```

##### `apify info`[​](#apify-info "Direct link to heading")

```
DESCRIPTION
  Prints details about your currently authenticated Apify account.

USAGE
  $ apify info
```

##### `apify secrets`[​](#apify-secrets "Direct link to heading")

```
DESCRIPTION
  Manages secure environment variables for Actors.

  Example:
  $ apify secrets add mySecret TopSecretValue123

  The "mySecret" value can be used in an environment variable defined in
  '.actor/actor.json' file by adding the "@" prefix:

  {
    "actorSpecification": 1,
    "name": "my_actor",
    "environmentVariables": { "SECRET_ENV_VAR": "@mySecret" },
    "version": "0.1"
  }

  When the Actor is pushed to Apify cloud, the "SECRET_ENV_VAR" and its value is
   stored as a secret environment variable of the Actor.

SUBCOMMANDS
  secrets add  Adds a new secret to '~/.apify' for use in Actor
               environment variables.
  secrets rm   Permanently deletes a secret from your stored
               credentials.
```

##### `apify secrets add`[​](#apify-secrets-add "Direct link to heading")

```
DESCRIPTION
  Adds a new secret to '~/.apify' for use in Actor environment variables.

USAGE
  $ apify secrets add <name> <value>

ARGUMENTS
  name   Name of the secret
  value  Value of the secret
```

##### `apify secrets rm`[​](#apify-secrets-rm "Direct link to heading")

```
DESCRIPTION
  Permanently deletes a secret from your stored credentials.

USAGE
  $ apify secrets rm <name>

ARGUMENTS
  name  Name of the secret
```

### Actor Development[​](#actor-development "Direct link to heading")

These commands help you develop Actors locally. Use them to create new Actor projects, initialize configurations, run Actors in development mode, and validate input schemas.

##### `apify create`[​](#apify-create "Direct link to heading")

```
DESCRIPTION
  Creates an Actor project from a template in a new directory.

USAGE
  $ apify create [actorName] [--omit-optional-deps]
                 [--skip-dependency-install] [-t <value>]

ARGUMENTS
  actorName  Name of the Actor and its directory

FLAGS
      --omit-optional-deps       Skip installing optional
                                 dependencies.
      --skip-dependency-install  Skip installing Actor
                                 dependencies.
  -t, --template=<value>         Template for the
                                 Actor. If not provided, the command will prompt for
                                 it. Visit
                                 https://raw.githubusercontent.com/apify/actor-templates/master/templates/manifest.json
                                 to find available template names.
```

##### `apify init`[​](#apify-init "Direct link to heading")

```
DESCRIPTION
  Sets up an Actor project in your current directory by creating actor.json and
  storage files.
  If the directory contains a Scrapy project in Python, the command
  automatically creates wrappers so that you can run your scrapers without
  changes.
  Creates the '.actor/actor.json' file and the 'storage' directory in the
  current directory, but does not touch any other existing files or directories.

  WARNING: Overwrites existing 'storage' directory.

USAGE
  $ apify init [actorName] [-y]

ARGUMENTS
  actorName  Name of the Actor. If not provided, you will be prompted
             for it.

FLAGS
  -y, --yes  Automatic yes to prompts; assume "yes" as answer to all
             prompts. Note that in some cases, the command may still ask for
             confirmation.
```

##### `apify run`[​](#apify-run "Direct link to heading")

```
DESCRIPTION
  Executes Actor locally with simulated Apify environment variables.
  Stores data in local 'storage' directory.

  NOTE: For Node.js Actors, customize behavior by modifying the 'start' script
  in package.json file.

USAGE
  $ apify run [--entrypoint <value>]
              [-i <value> | --input-file <value>] [-p | --resurrect]

FLAGS
      --entrypoint=<value>  Optional entrypoint for running
                            with injected environment variables.
                            For Python, it is the module name, or a path to a file.
                            For Node.js, it is the npm script name, or a path to a
                            JS/MJS file. You can also pass in a directory name,
                            provided that directory contains an "index.js" file.
  -i, --input=<value>       Optional JSON input to be
                            given to the Actor.
      --input-file=<value>  Optional path to a file with JSON
                            input to be given to the Actor. The file must be a valid
                            JSON file. You can also specify `-` to read from
                            standard input.
  -p, --purge               Whether to purge the default
                            request queue, dataset and key-value store before the
                            run starts.
                            For crawlee projects, this is the default behavior, and
                            the flag is optional.
                            Use `--no-purge` to keep the storage folder intact.
      --resurrect           Whether to keep the default
                            request queue, dataset and key-value store before the
                            run starts.
```

##### `apify validate-schema`[​](#apify-validate-schema "Direct link to heading")

```
DESCRIPTION
  Validates Actor input schema from one of these locations (in priority order):
    1. Object in '.actor/actor.json' under "input" key
    2. JSON file path in '.actor/actor.json' "input" key
    3. .actor/INPUT_SCHEMA.json
    4. INPUT_SCHEMA.json

  Optionally specify custom schema path to validate.

USAGE
  $ apify validate-schema [path]

ARGUMENTS
  path  Optional path to your INPUT_SCHEMA.json file. If not provided
        ./INPUT_SCHEMA.json is used.
```

### Actor Management[​](#actor-management "Direct link to heading")

These commands let you manage Actors on Apify platform. They provide functionality for deployment, execution, monitoring, and maintenance of your Actors in the cloud environment.

#### Basic Actor Operations[​](#basic-actor-operations "Direct link to heading")

Use these commands to handle core Actor operations like creation, listing, deletion, and basic runtime management. These are the essential commands for working with Actors on Apify platform.

##### `apify actors`[​](#apify-actors "Direct link to heading")

```
DESCRIPTION
  Manages Actor creation, deployment, and execution on the Apify platform.

SUBCOMMANDS
  actors start  Starts Actor remotely and returns run details
                immediately.
  actors rm     Permanently removes an Actor from your account.
  actors push   Deploys Actor to Apify platform using settings from
                '.actor/actor.json'.
  actors pull   Download Actor code to current directory. Clones Git
                repositories or fetches Actor files based on the source type.
  actors ls     Prints a list of recently executed Actors or Actors
                you own.
  actors info   Get information about an Actor.
  actors call   Executes Actor remotely using your authenticated
                account.
  actors build  Creates a new build of the Actor.
```

##### `apify actors ls`[​](#apify-actors-ls "Direct link to heading")

```
DESCRIPTION
  Prints a list of recently executed Actors or Actors you own.

USAGE
  $ apify actors ls [--desc] [--json] [--limit <value>] [--my]
                    [--offset <value>]

FLAGS
      --desc            Sort Actors in descending order.
      --json            Format the command output as JSON
      --limit=<value>   Number of Actors that will be listed.
      --my              Whether to list Actors made by the logged
                        in user.
      --offset=<value>  Number of Actors that will be skipped.
```

##### `apify actors rm`[​](#apify-actors-rm "Direct link to heading")

```
DESCRIPTION
  Permanently removes an Actor from your account.

USAGE
  $ apify actors rm <actorId>

ARGUMENTS
  actorId  The Actor ID to delete.
```

##### `apify actor`[​](#apify-actor "Direct link to heading")

```
DESCRIPTION
  Manages runtime data operations inside of a running Actor.

SUBCOMMANDS
  actor set-value       Sets or removes record into the
                        default key-value store associated with the Actor run.
  actor push-data       Saves data to Actor's run default
                        dataset.
  actor get-value       Gets a value from the default
                        key-value store associated with the Actor run.
  actor get-public-url  Get an HTTP URL that allows public
                        access to a key-value store item.
  actor get-input       Gets the Actor input value from the
                        default key-value store associated with the Actor run.
  actor charge          Charge for a specific event in the
                        pay-per-event Actor run.
```

##### `apify actor charge`[​](#apify-actor-charge "Direct link to heading")

```
DESCRIPTION
  Charge for a specific event in the pay-per-event Actor run.

USAGE
  $ apify actor charge <eventName> [--count <value>]
                       [--idempotency-key <value>] [--test-pay-per-event]

ARGUMENTS
  eventName  Name of the event to charge for

FLAGS
      --count=<value>            Number of events to
                                 charge
      --idempotency-key=<value>  Idempotency key for the
                                 charge request
      --test-pay-per-event       Test pay-per-event
                                 charging without actually charging
```

##### `apify actor get-input`[​](#apify-actor-get-input "Direct link to heading")

```
DESCRIPTION
  Gets the Actor input value from the default key-value store associated with
  the Actor run.

USAGE
  $ apify actor get-input
```

##### `apify actor get-public-url`[​](#apify-actor-get-public-url "Direct link to heading")

```
DESCRIPTION
  Get an HTTP URL that allows public access to a key-value store item.

USAGE
  $ apify actor get-public-url <key>

ARGUMENTS
  key  Key of the record in key-value store
```

##### `apify actor get-value`[​](#apify-actor-get-value "Direct link to heading")

```
DESCRIPTION
  Gets a value from the default key-value store associated with the Actor run.

USAGE
  $ apify actor get-value <key>

ARGUMENTS
  key  Key of the record in key-value store
```

##### `apify actor push-data`[​](#apify-actor-push-data "Direct link to heading")

```
DESCRIPTION
  Saves data to Actor's run default dataset.

  Accept input as:
    - JSON argument:
    $ apify actor push-data {"key": "value"}
    - Piped stdin:
    $ cat ./test.json | apify actor push-data

USAGE
  $ apify actor push-data [item]

ARGUMENTS
  item  JSON string with one object or array of objects containing data to
        be stored in the default dataset.
```

##### `apify actor set-value`[​](#apify-actor-set-value "Direct link to heading")

```
DESCRIPTION
  Sets or removes record into the default key-value store associated with the
  Actor run.

  It is possible to pass data using argument or stdin.

  Passing data using argument:
  $ apify actor set-value KEY my-value

  Passing data using stdin with pipe:
  $ cat ./my-text-file.txt | apify actor set-value KEY --contentType text/plain

USAGE
  $ apify actor set-value <key> [value] [-c <value>]

ARGUMENTS
  key    Key of the record in key-value store.
  value  Record data, which can be one of the following values:
         - If empty, the record in the key-value store is deleted.
         - If no `contentType` flag is specified, value is expected to be any JSON
         string value.
         - If options.contentType is set, value is taken as is.

FLAGS
  -c, --content-type=<value>  Specifies a custom MIME
                              content type of the record. By default
                              "application/json" is used.
```

#### Actor Deployment[​](#actor-deployment "Direct link to heading")

These commands handle the deployment workflow of Actors to Apify platform. Use them to push local changes, pull remote Actors, and manage Actor versions and builds.

##### `apify actors push` / `apify push`[​](#apify-actors-push--apify-push "Direct link to heading")

```
DESCRIPTION
  Deploys Actor to Apify platform using settings from '.actor/actor.json'.
  Files under '3' MB upload as "Multiple source files"; larger projects upload
  as ZIP file.
  Use --force to override newer remote versions.

USAGE
  $ apify actors push [actorId] [-b <value>] [--dir <value>]
                      [--force] [--open] [-v <value>] [-w <value>]

ARGUMENTS
  actorId  Name or ID of the Actor to push (e.g. "apify/hello-world" or
           "E2jjCZBezvAZnX8Rb"). If not provided, the command will create or
           modify the Actor with the name specified in '.actor/actor.json' file.

FLAGS
  -b, --build-tag=<value>        Build tag to be
                                 applied to the successful Actor build. By default,
                                 it is taken from the '.actor/actor.json' file
      --dir=<value>              Directory where the
                                 Actor is located
      --force                    Push an Actor even when
                                 the local files are older than the Actor on the
                                 platform.
      --open                     Whether to open the
                                 browser automatically to the Actor details page.
  -v, --version=<value>          Actor version number
                                 to which the files should be pushed. By default, it
                                 is taken from the '.actor/actor.json' file.
  -w, --wait-for-finish=<value>  Seconds for waiting
                                 to build to finish, if no value passed, it waits
                                 forever.
```

##### `apify actors pull` / `apify pull`[​](#apify-actors-pull--apify-pull "Direct link to heading")

```
DESCRIPTION
  Download Actor code to current directory. Clones Git repositories or fetches
  Actor files based on the source type.

USAGE
  $ apify actors pull [actorId] [--dir <value>] [-v <value>]

ARGUMENTS
  actorId  Name or ID of the Actor to run (e.g. "apify/hello-world" or
           "E2jjCZBezvAZnX8Rb"). If not provided, the command will update the
           Actor in the current directory based on its name in ".actor/actor.json"
           file.

FLAGS
      --dir=<value>      Directory where the Actor should be
                         pulled to
  -v, --version=<value>  Actor version number which will be
                         pulled, e.g. 1.2. Default: the highest version
```

##### `apify actors call` / `apify call`[​](#apify-actors-call--apify-call "Direct link to heading")

```
DESCRIPTION
  Executes Actor remotely using your authenticated account.
  Reads input from local key-value store by default.

USAGE
  $ apify actors call [actorId] [-b <value>]
                      [-i <value> | -f <value>] [--json] [-m <value>] [-o] [-s]
                      [-t <value>]

ARGUMENTS
  actorId  Name or ID of the Actor to run (e.g. "my-actor",
           "apify/hello-world" or "E2jjCZBezvAZnX8Rb"). If not provided, the
           command runs the remote Actor specified in the '.actor/actor.json'
           file.

FLAGS
  -b, --build=<value>       Tag or number of the build to
                            run (e.g. "latest" or "1.2.34").
  -i, --input=<value>       Optional JSON input to be
                            given to the Actor.
  -f, --input-file=<value>  Optional path to a file with
                            JSON input to be given to the Actor. The file must be a
                            valid JSON file. You can also specify `-` to read from
                            standard input.
      --json                Format the command output as JSON
  -m, --memory=<value>      Amount of memory allocated for
                            the Actor run, in megabytes.
  -o, --output-dataset      Prints out the entire default
                            dataset on successful run of the Actor.
  -s, --silent              Prevents printing the logs of
                            the Actor run to the console.
  -t, --timeout=<value>     Timeout for the Actor run in
                            seconds. Zero value means there is no timeout.
```

##### `apify actors start`[​](#apify-actors-start "Direct link to heading")

```
DESCRIPTION
  Starts Actor remotely and returns run details immediately.
  Uses authenticated account and local key-value store for input.

USAGE
  $ apify actors start [actorId] [-b <value>]
                       [-i <value> | --input-file <value>] [--json] [-m <value>]
                       [-t <value>]

ARGUMENTS
  actorId  Name or ID of the Actor to run (e.g. "my-actor",
           "apify/hello-world" or "E2jjCZBezvAZnX8Rb"). If not provided, the
           command runs the remote Actor specified in the '.actor/actor.json'
           file.

FLAGS
  -b, --build=<value>       Tag or number of the build to
                            run (e.g. "latest" or "1.2.34").
  -i, --input=<value>       Optional JSON input to be
                            given to the Actor.
      --input-file=<value>  Optional path to a file with JSON
                            input to be given to the Actor. The file must be a valid
                            JSON file. You can also specify `-` to read from
                            standard input.
      --json                Format the command output as JSON
  -m, --memory=<value>      Amount of memory allocated for
                            the Actor run, in megabytes.
  -t, --timeout=<value>     Timeout for the Actor run in
                            seconds. Zero value means there is no timeout.
```

##### `apify actors info`[​](#apify-actors-info "Direct link to heading")

```
DESCRIPTION
  Get information about an Actor.

USAGE
  $ apify actors info <actorId> [--input | --readme] [--json]

ARGUMENTS
  actorId  The ID of the Actor to return information about.

FLAGS
      --input   Return the Actor input schema.
      --json    Format the command output as JSON
      --readme  Return the Actor README.
```

#### Actor Builds[​](#actor-builds "Direct link to heading")

Use these commands to manage Actor build processes. They help you create, monitor, and maintain versioned snapshots of your Actors that can be executed on Apify platform.

##### `apify builds`[​](#apify-builds "Direct link to heading")

```
DESCRIPTION
  Manages Actor build processes and versioning.

SUBCOMMANDS
  builds rm      Permanently removes an Actor build from the Apify
                 platform.
  builds ls      Lists all builds of the Actor.
  builds log     Prints the log of a specific build.
  builds info    Prints information about a specific build.
  builds create  Creates a new build of the Actor.
```

##### `apify builds create` / `apify actors build`[​](#apify-builds-create--apify-actors-build "Direct link to heading")

```
DESCRIPTION
  Creates a new build of the Actor.

USAGE
  $ apify builds create [actorId] [--json] [--log]
                        [--tag <value>] [--version <value>]

ARGUMENTS
  actorId  Optional Actor ID or Name to trigger a build for. By default,
           it will use the Actor from the current directory.

FLAGS
      --json             Format the command output as JSON
      --log              Whether to print out the build log after
                         the build is triggered.
      --tag=<value>      Build tag to be applied to the
                         successful Actor build. By default, this is "latest".
      --version=<value>  Optional Actor Version to build. By
                         default, this will be inferred from the tag, but this flag
                         is required when multiple versions have the same tag.
```

##### `apify builds info`[​](#apify-builds-info "Direct link to heading")

```
DESCRIPTION
  Prints information about a specific build.

USAGE
  $ apify builds info <buildId> [--json]

ARGUMENTS
  buildId  The build ID to get information about.

FLAGS
      --json  Format the command output as JSON
```

##### `apify builds log`[​](#apify-builds-log "Direct link to heading")

```
DESCRIPTION
  Prints the log of a specific build.

USAGE
  $ apify builds log <buildId>

ARGUMENTS
  buildId  The build ID to get the log from.
```

##### `apify builds ls`[​](#apify-builds-ls "Direct link to heading")

```
DESCRIPTION
  Lists all builds of the Actor.

USAGE
  $ apify builds ls [actorId] [-c] [--desc] [--json]
                    [--limit <value>] [--offset <value>]

ARGUMENTS
  actorId  Optional Actor ID or Name to list runs for. By default, it
           will use the Actor from the current directory.

FLAGS
  -c, --compact         Display a compact table.
      --desc            Sort builds in descending order.
      --json            Format the command output as JSON
      --limit=<value>   Number of builds that will be listed.
      --offset=<value>  Number of builds that will be skipped.
```

##### `apify builds rm`[​](#apify-builds-rm "Direct link to heading")

```
DESCRIPTION
  Permanently removes an Actor build from the Apify platform.

USAGE
  $ apify builds rm <buildId>

ARGUMENTS
  buildId  The build ID to delete.
```

#### Actor Runs[​](#actor-runs "Direct link to heading")

These commands control Actor execution on Apify platform. Use them to start, monitor, and manage Actor runs, including accessing logs and handling execution states.

##### `apify runs`[​](#apify-runs "Direct link to heading")

```
DESCRIPTION
  Manages Actor run operations

SUBCOMMANDS
  runs abort      Aborts an Actor run.
  runs info       Prints information about an Actor run.
  runs log        Prints the log of a specific run.
  runs ls         Lists all runs of the Actor.
  runs resurrect  Resurrects an aborted or finished Actor Run.
  runs rm         Deletes an Actor Run.
```

##### `apify runs abort`[​](#apify-runs-abort "Direct link to heading")

```
DESCRIPTION
  Aborts an Actor run.

USAGE
  $ apify runs abort <runId> [-f] [--json]

ARGUMENTS
  runId  The run ID to abort.

FLAGS
  -f, --force  Whether to force the run to abort immediately, instead
               of gracefully.
      --json   Format the command output as JSON
```

##### `apify runs info`[​](#apify-runs-info "Direct link to heading")

```
DESCRIPTION
  Prints information about an Actor run.

USAGE
  $ apify runs info <runId> [--json] [-v]

ARGUMENTS
  runId  The run ID to print information about.

FLAGS
      --json     Format the command output as JSON
  -v, --verbose  Prints more in-depth information about the Actor
                 run.
```

##### `apify runs log`[​](#apify-runs-log "Direct link to heading")

```
DESCRIPTION
  Prints the log of a specific run.

USAGE
  $ apify runs log <runId>

ARGUMENTS
  runId  The run ID to get the log from.
```

##### `apify runs ls`[​](#apify-runs-ls "Direct link to heading")

```
DESCRIPTION
  Lists all runs of the Actor.

USAGE
  $ apify runs ls [actorId] [-c] [--desc] [--json]
                  [--limit <value>] [--offset <value>]

ARGUMENTS
  actorId  Optional Actor ID or Name to list runs for. By default, it
           will use the Actor from the current directory.

FLAGS
  -c, --compact         Display a compact table.
      --desc            Sort runs in descending order.
      --json            Format the command output as JSON
      --limit=<value>   Number of runs that will be listed.
      --offset=<value>  Number of runs that will be skipped.
```

##### `apify runs resurrect`[​](#apify-runs-resurrect "Direct link to heading")

```
DESCRIPTION
  Resurrects an aborted or finished Actor Run.

USAGE
  $ apify runs resurrect <runId> [--json]

ARGUMENTS
  runId  The run ID to resurrect.

FLAGS
      --json  Format the command output as JSON
```

##### `apify runs rm`[​](#apify-runs-rm "Direct link to heading")

```
DESCRIPTION
  Deletes an Actor Run.

USAGE
  $ apify runs rm <runId>

ARGUMENTS
  runId  The run ID to delete.
```

### Storage[​](#storage "Direct link to heading")

These commands manage data storage on Apify platform. Use them to work with datasets, key-value stores, and request queues for persistent data storage and retrieval.

#### Datasets[​](#datasets "Direct link to heading")

Use these commands to manage datasets, which provide structured storage for tabular data. They enable creation, modification, and data manipulation within datasets.

##### `apify datasets`[​](#apify-datasets "Direct link to heading")

```
DESCRIPTION
  Manages structured data storage and retrieval.

SUBCOMMANDS
  datasets create      Creates a new dataset for storing
                       structured data on your account.
  datasets get-items   Retrieves dataset items in specified
                       format (JSON, CSV, etc).
  datasets ls          Prints all datasets on your account.
  datasets info        Prints information about a specific
                       dataset.
  datasets rm          Permanently removes a dataset.
  datasets rename      Change dataset name or removes name
                       with --unname flag.
  datasets push-items  Adds data items to specified dataset.
                       Accepts single object or array of objects.
```

##### `apify datasets create`[​](#apify-datasets-create "Direct link to heading")

```
DESCRIPTION
  Creates a new dataset for storing structured data on your account.

USAGE
  $ apify datasets create [datasetName] [--json]

ARGUMENTS
  datasetName  Optional name for the Dataset

FLAGS
      --json  Format the command output as JSON
```

##### `apify datasets get-items`[​](#apify-datasets-get-items "Direct link to heading")

```
DESCRIPTION
  Retrieves dataset items in specified format (JSON, CSV, etc).

USAGE
  $ apify datasets get-items <datasetId>
                             [--format json|jsonl|csv|html|rss|xml|xlsx]
                             [--limit <value>] [--offset <value>]

ARGUMENTS
  datasetId  The ID of the Dataset to export the items for

FLAGS
      --format=<option>  The format of the returned output. By
                         default, it is set to 'json'
                         <options: json|jsonl|csv|html|rss|xml|xlsx>
      --limit=<value>    The amount of elements to get from the
                         dataset. By default, it will return all available items.
      --offset=<value>   The offset in the dataset where to start
                         getting items.
```

##### `apify datasets info`[​](#apify-datasets-info "Direct link to heading")

```
DESCRIPTION
  Prints information about a specific dataset.

USAGE
  $ apify datasets info <storeId> [--json]

ARGUMENTS
  storeId  The dataset store ID to print information about.

FLAGS
      --json  Format the command output as JSON
```

##### `apify datasets ls`[​](#apify-datasets-ls "Direct link to heading")

```
DESCRIPTION
  Prints all datasets on your account.

USAGE
  $ apify datasets ls [--desc] [--json] [--limit <value>]
                      [--offset <value>] [--unnamed]

FLAGS
      --desc            Sorts datasets in descending order.
      --json            Format the command output as JSON
      --limit=<value>   Number of datasets that will be listed.
      --offset=<value>  Number of datasets that will be skipped.
      --unnamed         Lists datasets that don't have a name set.
```

##### `apify datasets push-items`[​](#apify-datasets-push-items "Direct link to heading")

```
DESCRIPTION
  Adds data items to specified dataset. Accepts single object or array of
  objects.

USAGE
  $ apify datasets push-items <nameOrId> [item]

ARGUMENTS
  nameOrId  The dataset ID or name to push the objects to
  item      The object or array of objects to be pushed.
```

##### `apify datasets rename`[​](#apify-datasets-rename "Direct link to heading")

```
DESCRIPTION
  Change dataset name or removes name with --unname flag.

USAGE
  $ apify datasets rename <nameOrId> [newName] [--unname]

ARGUMENTS
  nameOrId  The dataset ID or name to delete.
  newName   The new name for the dataset.

FLAGS
      --unname  Removes the unique name of the dataset.
```

##### `apify datasets rm`[​](#apify-datasets-rm "Direct link to heading")

```
DESCRIPTION
  Permanently removes a dataset.

USAGE
  $ apify datasets rm <datasetNameOrId>

ARGUMENTS
  datasetNameOrId  The dataset ID or name to delete
```

#### Key-Value Stores[​](#key-value-stores "Direct link to heading")

These commands handle key-value store operations. Use them to create stores, manage key-value pairs, and handle persistent storage of arbitrary data types.

##### `apify key-value-stores`[​](#apify-key-value-stores "Direct link to heading")

```
DESCRIPTION
  Manages persistent key-value storage.

  Alias: kvs

SUBCOMMANDS
  key-value-stores create        Creates a new
                                 key-value store on your account.
  key-value-stores delete-value  Delete a value
                                 from a key-value store.
  key-value-stores get-value     Retrieves stored
                                 value for specified key. Use --only-content-type
                                 to check MIME type.
  key-value-stores info          Shows information
                                 about a key-value store.
  key-value-stores keys          Lists all keys in
                                 a key-value store.
  key-value-stores ls            Lists all
                                 key-value stores on your account.
  key-value-stores rename        Renames a
                                 key-value store, or removes its unique name.
  key-value-stores rm            Permanently
                                 removes a key-value store.
  key-value-stores set-value     Stores value with
                                 specified key. Set content-type with
                                 --content-type flag.
```

##### `apify key-value-stores create`[​](#apify-key-value-stores-create "Direct link to heading")

```
DESCRIPTION
  Creates a new key-value store on your account.

USAGE
  $ apify key-value-stores create
                                  [key-value store name] [--json]

ARGUMENTS
  key-value store name  Optional name for the key-value
                        store

FLAGS
      --json  Format the command output as JSON
```

##### `apify key-value-stores delete-value`[​](#apify-key-value-stores-delete-value "Direct link to heading")

```
DESCRIPTION
  Delete a value from a key-value store.

USAGE
  $ apify key-value-stores delete-value
                                        <store id> <itemKey>

ARGUMENTS
  store id  The key-value store ID to delete the value from.
  itemKey   The key of the item in the key-value store.
```

##### `apify key-value-stores get-value`[​](#apify-key-value-stores-get-value "Direct link to heading")

```
DESCRIPTION
  Retrieves stored value for specified key. Use --only-content-type to check
  MIME type.

USAGE
  $ apify key-value-stores get-value
                                     <keyValueStoreId> <itemKey>
                                     [--only-content-type]

ARGUMENTS
  keyValueStoreId  The key-value store ID to get the value from.
  itemKey          The key of the item in the key-value store.

FLAGS
      --only-content-type  Only return the content type of the
                           specified key
```

##### `apify key-value-stores info`[​](#apify-key-value-stores-info "Direct link to heading")

```
DESCRIPTION
  Shows information about a key-value store.

USAGE
  $ apify key-value-stores info <storeId> [--json]

ARGUMENTS
  storeId  The key-value store ID to print information about.

FLAGS
      --json  Format the command output as JSON
```

##### `apify key-value-stores keys`[​](#apify-key-value-stores-keys "Direct link to heading")

```
DESCRIPTION
  Lists all keys in a key-value store.

USAGE
  $ apify key-value-stores keys <storeId>
                                [--exclusive-start-key <value>] [--json]
                                [--limit <value>]

ARGUMENTS
  storeId  The key-value store ID to list keys for.

FLAGS
      --exclusive-start-key=<value>  The key to start
                                     the list from.
      --json                         Format the
                                     command output as JSON
      --limit=<value>                The maximum
                                     number of keys to return.
```

##### `apify key-value-stores ls`[​](#apify-key-value-stores-ls "Direct link to heading")

```
DESCRIPTION
  Lists all key-value stores on your account.

USAGE
  $ apify key-value-stores ls [--desc] [--json]
                              [--limit <value>] [--offset <value>] [--unnamed]

FLAGS
      --desc            Sorts key-value stores in descending
                        order.
      --json            Format the command output as JSON
      --limit=<value>   Number of key-value stores that will be
                        listed.
      --offset=<value>  Number of key-value stores that will be
                        skipped.
      --unnamed         Lists key-value stores that don't have a
                        name set.
```

##### `apify key-value-stores rename`[​](#apify-key-value-stores-rename "Direct link to heading")

```
DESCRIPTION
  Renames a key-value store, or removes its unique name.

USAGE
  $ apify key-value-stores rename
                                  <keyValueStoreNameOrId> [newName] [--unname]

ARGUMENTS
  keyValueStoreNameOrId  The key-value store ID or name to
                         delete
  newName                The new name for the key-value
                         store

FLAGS
      --unname  Removes the unique name of the key-value store
```

##### `apify key-value-stores rm`[​](#apify-key-value-stores-rm "Direct link to heading")

```
DESCRIPTION
  Permanently removes a key-value store.

USAGE
  $ apify key-value-stores rm <keyValueStoreNameOrId>

ARGUMENTS
  keyValueStoreNameOrId  The key-value store ID or name to
                         delete
```

##### `apify key-value-stores set-value`[​](#apify-key-value-stores-set-value "Direct link to heading")

```
DESCRIPTION
  Stores value with specified key. Set content-type with --content-type flag.

USAGE
  $ apify key-value-stores set-value <storeId>
                                     <itemKey> [value] [--content-type <value>]

ARGUMENTS
  storeId  The key-value store ID to set the value in.
  itemKey  The key of the item in the key-value store.
  value    The value to set.

FLAGS
      --content-type=<value>  The MIME content type of the
                              value. By default, "application/json" is assumed.
```

#### Request Queues[​](#request-queues "Direct link to heading")

These commands manage request queues, which handle URL processing for web scraping and automation tasks. Use them to maintain lists of URLs with automatic retry mechanisms and state management.

##### `apify request-queues`[​](#apify-request-queues "Direct link to heading")

```
DESCRIPTION
  Manages URL queues for web scraping and automation tasks.

USAGE
  $ apify request-queues
```

### Tasks[​](#tasks "Direct link to heading")

These commands help you manage scheduled and configured Actor runs. Use them to create, modify, and execute predefined Actor configurations as tasks.

##### `apify task`[​](#apify-task "Direct link to heading")

```
DESCRIPTION
  Manages scheduled and predefined Actor configurations.

SUBCOMMANDS
  task run  Executes predefined Actor task remotely using local
            key-value store for input.
```

##### `apify task run`[​](#apify-task-run "Direct link to heading")

```
DESCRIPTION
  Executes predefined Actor task remotely using local key-value store for input.
  Customize with --memory and --timeout flags.

USAGE
  $ apify task run <taskId> [-b <value>] [-m <value>]
                   [-t <value>]

ARGUMENTS
  taskId  Name or ID of the Task to run (e.g. "my-task" or
          "E2jjCZBezvAZnX8Rb").

FLAGS
  -b, --build=<value>    Tag or number of the build to run
                         (e.g. "latest" or "1.2.34").
  -m, --memory=<value>   Amount of memory allocated for the
                         Task run, in megabytes.
  -t, --timeout=<value>  Timeout for the Task run in seconds.
                         Zero value means there is no timeout.
```
# Troubleshooting

View as MarkdownCopy for LLM

## Problems with installation[​](#problems-with-installation "Direct link to heading")

If you receive a permission error, read npm's [official guide](https://docs.npmjs.com/resolving-eacces-permissions-errors-when-installing-packages-globally) on installing packages globally.

The best practice is to use a Node.js version manager to install Node.js 22+. It prevents permission issues from happening in the first place. We recommend:

* [fnm (Fast Node Manager)](https://github.com/Schniz/fnm)
* [Volta](https://volta.sh/).

Once you have the correct version of Node.js on your machine, install the Apify CLI with the following command:

```
npm install -g apify-cli
```

## Migrations[​](#migrations "Direct link to heading")

You can find the differences and migration info in [migration guidelines](https://github.com/apify/apify-cli/blob/master/MIGRATIONS.md).

## Help command[​](#help-command "Direct link to heading")

To see all CLI commands simply run:

```
apify help
```

To get information about a specific command run:

```
apify help COMMAND
```

## Need help?[​](#need-help "Direct link to heading")

For general support, reach out to us at [apify.com/contact](https://apify.com/contact). You can also join [Apify Discord](https://apify.com/discord), if you have a question. If you believe you are encountering a bug, file it on [GitHub](https://github.com/apify/apify-cli/issues/new).

OpenAPI definition

Here you can export the OpenAPI 3.0.1 specification of the API for running the Actor with a custom input and synchronously returning its output dataset, using the Run Actor synchronously with input and get dataset items API endpoint. You can use this definition, for example, to integrate the Actor to OpenAI GPTs. Read more

{
  "openapi": "3.0.1",
  "info": {
    "title": "Google Maps Scraper",
    "description": "Extract data from thousands of Google Maps locations and businesses, including reviews, reviewer details, images, contact info, opening hours, location, prices & more. Export scraped data, run the scraper via API, schedule and monitor runs, or integrate with other tools.",
    "version": "0.14",
    "x-build-id": "UAT1uoKI8z73eNjbD"
  },
  "servers": [
    {
      "url": "https://api.apify.com/v2"
    }
  ],
  "paths": {
    "/acts/compass~crawler-google-places/run-sync-get-dataset-items": {
      "post": {
        "operationId": "run-sync-get-dataset-items-compass-crawler-google-places",
        "x-openai-isConsequential": false,
        "summary": "Executes an Actor, waits for its completion, and returns Actor's dataset items in response.",
        "tags": [
          "Run Actor"
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/inputSchema"
              }
            }
          }
        },
        "parameters": [
          {
            "name": "token",
            "in": "query",
            "required": true,
            "schema": {
              "type": "string"
            },
            "description": "Enter your Apify token here"
          }
        ],
        "responses": {
          "200": {
            "description": "OK"
          }
        }
      }
    },
    "/acts/compass~crawler-google-places/runs": {
      "post": {
        "operationId": "runs-sync-compass-crawler-google-places",
        "x-openai-isConsequential": false,
        "summary": "Executes an Actor and returns information about the initiated run in response.",
        "tags": [
          "Run Actor"
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/inputSchema"
              }
            }
          }
        },
        "parameters": [
          {
            "name": "token",
            "in": "query",
            "required": true,
            "schema": {
              "type": "string"
            },
            "description": "Enter your Apify token here"
          }
        ],
        "responses": {
          "200": {
            "description": "OK",
            "content": {
              "application/json": {
                "schema": {
                  "$ref": "#/components/schemas/runsResponseSchema"
                }
              }
            }
          }
        }
      }
    },
    "/acts/compass~crawler-google-places/run-sync": {
      "post": {
        "operationId": "run-sync-compass-crawler-google-places",
        "x-openai-isConsequential": false,
        "summary": "Executes an Actor, waits for completion, and returns the OUTPUT from Key-value store in response.",
        "tags": [
          "Run Actor"
        ],
        "requestBody": {
          "required": true,
          "content": {
            "application/json": {
              "schema": {
                "$ref": "#/components/schemas/inputSchema"
              }
            }
          }
        },
        "parameters": [
          {
            "name": "token",
            "in": "query",
            "required": true,
            "schema": {
              "type": "string"
            },
            "description": "Enter your Apify token here"
          }
        ],
        "responses": {
          "200": {
            "description": "OK"
          }
        }
      }
    }
  },
  "components": {
    "schemas": {
      "inputSchema": {
        "type": "object",
        "properties": {
          "searchStringsArray": {
            "title": "🔍 Search term(s)",
            "type": "array",
            "description": "Type what you’d normally search for in the Google Maps search bar, like <b>English breakfast</b> or <b>pet shelter</b>. Aim for unique terms for faster processing. Using similar terms (e.g., <b>bar</b> vs. <b>restaurant</b> vs. <b>cafe</b>) may slightly increase your capture rate but is less efficient.<br><br> ⚠️ Heads up: Adding a location directly to the search, e.g., <b>restaurant Pittsburgh</b>, can limit you to a maximum of 120 results per search term due to <a href='https://blog.apify.com/google-places-api-limits/#%E2%9B%94-what-are-google-maps-limitations-for-scraping'>Google Maps' scrolling limit</a>.<br><br> You can also use direct place IDs here in the format <code>place_id:ChIJ8_JBApXMDUcRDzXcYUPTGUY</code>.See the [detailed description](https://apify.com/compass/crawler-google-places#search-terms).",
            "items": {
              "type": "string"
            }
          },
          "locationQuery": {
            "title": "📍 Location (use only one location per run)",
            "type": "string",
            "description": "Define location using free text. Simpler formats work best; e.g., use City + Country rather than City + Country + State. Verify with the <a href='https://nominatim.openstreetmap.org/ui/search.html'>OpenStreetMap webapp</a> for visual validation of the exact area you want to cover. <br><br>⚠️ Automatically defined City polygons may be smaller than expected (e.g., they don't include agglomeration areas). If you need to define the whole city area, head over to the 📡 <b>Geolocation parameters*</b> section instead to select Country, State, County, City, or Postal code.<br>For an even more precise location definition (especially when using City name as a starting point), head over to <b>🛰 Custom search area</b> section to create polygon shapes of the areas you want to scrape. Note that 📍 <b>Location</b> settings always take priority over <b>📡 Geolocation*</b> (so use either section but not both at the same time). <br><br>For guidance and tricks on location definition, check <a href='https://blog.apify.com/google-places-api-limits/#2-choose-the-location-using-regular-toponomy%F0%9F%93%8D'>our tutorial</a>."
          },
          "maxCrawledPlacesPerSearch": {
            "title": "💯 Number of places to extract (per each search term or URL)",
            "minimum": 1,
            "type": "integer",
            "description": "Number of results you expect to get per each Search term, Category or URL. The higher the number, the longer it will take. <br><br>If you want to scrape all the places available, <b>leave this field empty</b> or use this section <b>🧭 Scrape all places on the map*</b>."
          },
          "language": {
            "title": "🌍 Language",
            "enum": [
              "en",
              "af",
              "az",
              "id",
              "ms",
              "bs",
              "ca",
              "cs",
              "da",
              "de",
              "et",
              "es",
              "es-419",
              "eu",
              "fil",
              "fr",
              "gl",
              "hr",
              "zu",
              "is",
              "it",
              "sw",
              "lv",
              "lt",
              "hu",
              "nl",
              "no",
              "uz",
              "pl",
              "pt-BR",
              "pt-PT",
              "ro",
              "sq",
              "sk",
              "sl",
              "fi",
              "sv",
              "vi",
              "tr",
              "el",
              "bg",
              "ky",
              "kk",
              "mk",
              "mn",
              "ru",
              "sr",
              "uk",
              "ka",
              "hy",
              "iw",
              "ur",
              "ar",
              "fa",
              "am",
              "ne",
              "hi",
              "mr",
              "bn",
              "pa",
              "gu",
              "ta",
              "te",
              "kn",
              "ml",
              "si",
              "th",
              "lo",
              "my",
              "km",
              "ko",
              "ja",
              "zh-CN",
              "zh-TW"
            ],
            "type": "string",
            "description": "Results details will show in this language.",
            "default": "en"
          },
          "categoryFilterWords": {
            "title": "🎢 Place categories ($)",
            "type": "array",
            "description": "You can limit the places that are scraped based on the Category filter; you can choose as many categories for one flat fee for the whole field. ⚠️ Using categories can sometimes lead to false negatives, as many places do not properly categorize themselves, and there are over <a href='https://api.apify.com/v2/key-value-stores/epxZwNRgmnzzBpNJd/records/categories'> 4,000</a> available categories which Google Maps has. Using categories might filter out places that you’d like to scrape. To avoid this problem, you must list all categories that you want to scrape, including synonyms, e.g., divorce lawyer, divorce attorney, divorce service, etc. See the [detailed description](https://apify.com/compass/crawler-google-places#categories).",
            "items": {
              "type": "string",
              "enum": [
                "abbey",
                "accountant",
                "accounting",
                "acupuncturist",
                "aeroclub",
                "agriculture",
                "airline",
                "airport",
                "airstrip",
                "allergist",
                "amphitheater",
                "amphitheatre",
                "anesthesiologist",
                "appraiser",
                "aquarium",
                "arboretum",
                "architect",
                "archive",
                "arena",
                "artist",
                "ashram",
                "astrologer",
                "atm",
                "attorney",
                "audiologist",
                "auditor",
                "auditorium",
                "bakery",
                "band",
                "bank",
                "bar",
                "barrister",
                "basilica",
                "bazar",
                "beach",
                "beautician",
                "bistro",
                "blacksmith",
                "bodega",
                "bookbinder",
                "botanica",
                "boutique",
                "brasserie",
                "brewery",
                "brewpub",
                "bricklayer",
                "bridge",
                "builder",
                "building",
                "bullring",
                "butchers",
                "cafe",
                "cafeteria",
                "campground",
                "cannery",
                "cardiologist",
                "carpenter",
                "cars",
                "carvery",
                "cashpoint",
                "casino",
                "castle",
                "caterer",
                "catering",
                "cathedral",
                "cattery",
                "cemetery",
                "chalet",
                "chapel",
                "charcuterie",
                "charity",
                "chemist",
                "childminder",
                "chiropractor",
                "choir",
                "church",
                "churreria",
                "circus",
                "cleaners",
                "clergyman",
                "clinic",
                "club",
                "coalfield",
                "college",
                "company",
                "computers",
                "congregation",
                "construction",
                "consultant",
                "contractor",
                "conveyancer",
                "coppersmith",
                "cottage",
                "council",
                "counselor",
                "courthouse",
                "creperie",
                "dairy",
                "deli",
                "delicatessen",
                "dentist",
                "dermatologist",
                "design",
                "dhaba",
                "diabetologist",
                "dietitian",
                "diner",
                "distillery",
                "dj",
                "doctor",
                "doula",
                "dressmaker",
                "dyeworks",
                "eatery",
                "education",
                "electrician",
                "embassy",
                "endocrinologist",
                "endodontist",
                "endoscopist",
                "engineer",
                "engraver",
                "entertainer",
                "entertainment",
                "establishment",
                "executor",
                "exhibit",
                "exporter",
                "fairground",
                "farm",
                "farmstay",
                "favela",
                "festival",
                "florist",
                "fortress",
                "foundation",
                "foundry",
                "frituur",
                "garden",
                "gardener",
                "gasfitter",
                "gastroenterologist",
                "gastropub",
                "gemologist",
                "genealogist",
                "geriatrician",
                "glazier",
                "goldsmith",
                "government",
                "greengrocer",
                "greenhouse",
                "grill",
                "gurudwara",
                "gym",
                "gynecologist",
                "haberdashery",
                "hairdresser",
                "hammam",
                "handicraft",
                "handyman/handywoman/handyperson",
                "health",
                "heliport",
                "hematologist",
                "hepatologist",
                "herbalist",
                "homeopath",
                "homestay",
                "hospice",
                "hospital",
                "hostel",
                "hotel",
                "hypermarket",
                "immunologist",
                "importer",
                "inn",
                "instruction",
                "intensivist",
                "internist",
                "island",
                "jeweler",
                "joiner",
                "junkyard",
                "karaoke",
                "kennel",
                "kindergarten",
                "kinesiologist",
                "kinesiotherapist",
                "kiosk",
                "laboratory",
                "lake",
                "landscaper",
                "lapidary",
                "laundromat",
                "laundry",
                "lawyer",
                "library",
                "lido",
                "liquidator",
                "locksmith",
                "lodge",
                "lodging",
                "lounge",
                "lyceum",
                "magician",
                "makerspace",
                "manufacturer",
                "marae",
                "marina",
                "market",
                "mechanic",
                "memorial",
                "metalwork",
                "meyhane",
                "midwife",
                "mill",
                "mine",
                "mission",
                "mohel",
                "monastery",
                "monument",
                "mortuary",
                "mosque",
                "motel",
                "mover",
                "musalla",
                "museum",
                "musician",
                "nephrologist",
                "neurologist",
                "neurophysiologist",
                "neuropsychologist",
                "neurosurgeon",
                "newsstand",
                "numerologist",
                "nutritionist",
                "observatory",
                "obstetrician-gynecologist",
                "office",
                "oilfield",
                "oncologist",
                "onsen",
                "ophthalmologist",
                "optician",
                "optometrist",
                "orchard",
                "orchestra",
                "orphanage",
                "orthodontist",
                "orthoptist",
                "osteopath",
                "otolaryngologist",
                "pagoda",
                "painter",
                "painting",
                "parapharmacy",
                "parish",
                "park",
                "parking",
                "pathologist",
                "patisserie",
                "pediatrician",
                "pedorthist",
                "periodontist",
                "pharmacy",
                "photographer",
                "physiatrist",
                "physiotherapist",
                "planetarium",
                "plasterer",
                "playground",
                "playgroup",
                "plumber",
                "podiatrist",
                "pre-school",
                "preschool",
                "priest",
                "prison",
                "proctologist",
                "promenade",
                "prosthodontist",
                "psychiatrist",
                "psychic",
                "psychoanalyst",
                "psychologist",
                "psychotherapist",
                "pub",
                "publisher",
                "pulmonologist",
                "pyrotechnician",
                "quarry",
                "radiologist",
                "radiotherapist",
                "rafting",
                "ranch",
                "recreation",
                "recruiter",
                "rectory",
                "reflexologist",
                "remodeler",
                "restaurant",
                "rheumatologist",
                "river",
                "rodeo",
                "rugby",
                "sacem",
                "saddlery",
                "sailmaker",
                "sambodrome",
                "sauna",
                "school",
                "scouting",
                "sculptor",
                "sculpture",
                "seitai",
                "seminary",
                "services",
                "sexologist",
                "shelter",
                "shipyard",
                "shop",
                "shopfitter",
                "showroom",
                "shrine",
                "silversmith",
                "skatepark",
                "slaughterhouse",
                "soapland",
                "spa",
                "sports",
                "stable",
                "stadium",
                "stage",
                "statuary",
                "store",
                "stylist",
                "supermarket",
                "surgeon",
                "surveyor",
                "synagogue",
                "tailor",
                "takeaway",
                "tannery",
                "taxidermist",
                "toolroom",
                "travel",
                "turnery",
                "university",
                "urologist",
                "velodrome",
                "venereologist",
                "veterinarian",
                "villa",
                "vineyard",
                "warehouse",
                "weir",
                "welder",
                "wholesaler",
                "winery",
                "woods",
                "woodworker",
                "yakatabune",
                "yeshiva",
                "zoo",
                "abarth dealer",
                "abortion clinic",
                "abrasives supplier",
                "academic department",
                "açaí shop",
                "acaraje restaurant",
                "accounting firm",
                "accounting school",
                "acoustical consultant",
                "acrylic store",
                "acupuncture clinic",
                "acupuncture school",
                "acura dealer",
                "administrative attorney",
                "adoption agency",
                "advertising agency",
                "advertising photographer",
                "advertising service",
                "aerial photographer",
                "aerobics instructor",
                "aeromodel shop",
                "aeronautical engineer",
                "aerospace company",
                "afghan restaurant",
                "african restaurant",
                "agenzia entrate",
                "aggregate supplier",
                "agistment service",
                "agricultural association",
                "agricultural cooperative",
                "agricultural engineer",
                "agricultural organization",
                "agricultural production",
                "agricultural service",
                "agrochemicals supplier",
                "aikido club",
                "aikido school",
                "air taxi",
                "airbrushing service",
                "aircraft dealer",
                "aircraft manufacturer",
                "alcohol manufacturer",
                "alliance church",
                "alsace restaurant",
                "alternator supplier",
                "aluminium supplier",
                "aluminum supplier",
                "aluminum welder",
                "aluminum window",
                "ambulance service",
                "american restaurant",
                "ammunition supplier",
                "amusement center",
                "amusement park",
                "anago restaurant",
                "andalusian restaurant",
                "andhra restaurant",
                "anganwadi center",
                "anglican church",
                "animal hospital",
                "animal shelter",
                "animation studio",
                "anime club",
                "antenna service",
                "antique store",
                "apartment building",
                "apartment complex",
                "apostolic church",
                "apparel company",
                "appliance store",
                "apprenticeship center",
                "aquaculture farm",
                "aquarium shop",
                "aquatic centre",
                "arab restaurant",
                "arborist service",
                "archaeological museum",
                "archery club",
                "archery range",
                "archery store",
                "architects association",
                "architectural designer",
                "architecture firm",
                "architecture school",
                "argentinian restaurant",
                "armenian church",
                "armenian restaurant",
                "army facility",
                "army museum",
                "aromatherapy class",
                "aromatherapy service",
                "art cafe",
                "art center",
                "art dealer",
                "art gallery",
                "art museum",
                "art school",
                "art studio",
                "artistic handicrafts",
                "arts organization",
                "asian restaurant",
                "asphalt contractor",
                "assamese restaurant",
                "assistante maternelle",
                "asturian restaurant",
                "athletic club",
                "athletic field",
                "athletic park",
                "athletic track",
                "atv dealer",
                "auction house",
                "audi dealer",
                "australian restaurant",
                "austrian restaurant",
                "auto auction",
                "auto broker",
                "auto market",
                "auto painting",
                "auto upholsterer",
                "auto wrecker",
                "automation company",
                "aviation consultant",
                "awadhi restaurant",
                "awning supplier",
                "ayurvedic clinic",
                "azerbaijani restaurant",
                "baby store",
                "baden restaurant",
                "badminton club",
                "badminton complex",
                "badminton court",
                "bag shop",
                "bagel shop",
                "bait shop",
                "bakery equipment",
                "bakso restaurant",
                "balinese restaurant",
                "ballet school",
                "ballet theater",
                "balloon artist",
                "balloon store",
                "bangladeshi restaurant",
                "bangle shop",
                "bankruptcy attorney",
                "bankruptcy service",
                "banner store",
                "banquet hall",
                "baptist church",
                "bar pmu",
                "bar tabac",
                "barbecue area",
                "barbecue restaurant",
                "barber school",
                "barber shop",
                "bariatric surgeon",
                "bark supplier",
                "barrel supplier",
                "bartending school",
                "baseball club",
                "baseball field",
                "basket supplier",
                "basketball club",
                "basketball court",
                "basque restaurant",
                "batak restaurant",
                "bathroom remodeler",
                "bathroom renovator",
                "battery manufacturer",
                "battery store",
                "battery wholesaler",
                "bavarian restaurant",
                "beach club",
                "beach pavillion",
                "bead store",
                "bead wholesaler",
                "bearing supplier",
                "beauty parlour",
                "beauty salon",
                "beauty school",
                "bed shop",
                "bedding store",
                "beer distributor",
                "beer garden",
                "beer hall",
                "beer store",
                "belgian restaurant",
                "belt shop",
                "bengali restaurant",
                "bentley dealer",
                "berry restaurant",
                "betawi restaurant",
                "betting agency",
                "beverage distributor",
                "bicycle club",
                "bicycle rack",
                "bicycle shop",
                "bicycle store",
                "bicycle wholesaler",
                "bike wash",
                "bilingual school",
                "bingo hall",
                "biochemistry lab",
                "biofeedback therapist",
                "biotechnology company",
                "bird shop",
                "birth center",
                "biryani restaurant",
                "blinds shop",
                "blood bank",
                "blueprint service",
                "blues club",
                "bmw dealer",
                "bmx club",
                "bmx park",
                "boarding house",
                "boarding school",
                "boat builders",
                "boat club",
                "boat dealer",
                "boat ramp",
                "boating instructor",
                "boiler manufacturer",
                "boiler supplier",
                "bonesetting house",
                "book publisher",
                "book store",
                "bookkeeping service",
                "books wholesaler",
                "boot camp",
                "boot store",
                "border guard",
                "botanical garden",
                "bowling alley",
                "bowling club",
                "boxing club",
                "boxing gym",
                "boxing ring",
                "boys' hostel",
                "bpo company",
                "brake shop",
                "branding agency",
                "brazilian pastelaria",
                "brazilian restaurant",
                "breakfast restaurant",
                "brick manufacturer",
                "bridal shop",
                "bridge club",
                "british restaurant",
                "brunch restaurant",
                "buddhist temple",
                "buffet restaurant",
                "bugatti dealer",
                "buick dealer",
                "building consultant",
                "building designer",
                "building firm",
                "building inspector",
                "building society",
                "bulgarian restaurant",
                "burmese restaurant",
                "burrito restaurant",
                "bus charter",
                "bus company",
                "bus depot",
                "bus station",
                "bus stop",
                "business attorney",
                "business broker",
                "business center",
                "business park",
                "business school",
                "butcher shop",
                "butsudan store",
                "cabaret club",
                "cabinet maker",
                "cabinet store",
                "cable company",
                "cadillac dealer",
                "cajun restaurant",
                "cake shop",
                "californian restaurant",
                "call center",
                "call shop",
                "calligraphy lesson",
                "cambodian restaurant",
                "camera store",
                "camping cabin",
                "camping farm",
                "camping store",
                "canadian restaurant",
                "candle store",
                "candy store",
                "cannabis club",
                "cannabis store",
                "canoeing area",
                "cantabrian restaurant",
                "cantonese restaurant",
                "capoeira school",
                "capsule hotel",
                "car dealer",
                "car factory",
                "car manufacturer",
                "car wash",
                "carabinieri police",
                "care services",
                "caribbean restaurant",
                "carnival club",
                "carpet installer",
                "carpet manufacturer",
                "carpet store",
                "carpet wholesaler",
                "casket service",
                "castilian restaurant",
                "cat breeder",
                "cat cafe",
                "cat trainer",
                "catalonian restaurant",
                "catholic cathedral",
                "catholic church",
                "catholic school",
                "cattle farm",
                "cattle market",
                "caucasian restaurant",
                "cbse school",
                "cd store",
                "ceiling supplier",
                "cement manufacturer",
                "cement supplier",
                "cendol restaurant",
                "central bank",
                "ceramic manufacturer",
                "ceramics wholesaler",
                "certification agency",
                "charter school",
                "chartered accountant",
                "chauffeur service",
                "cheese manufacturer",
                "cheese shop",
                "cheesesteak restaurant",
                "chemical exporter",
                "chemical industry",
                "chemical manufacturer",
                "chemical plant",
                "chemical wholesaler",
                "chemistry lab",
                "chesapeake restaurant",
                "chess club",
                "chess instructor",
                "chevrolet dealer",
                "chicken restaurant",
                "chicken shop",
                "child psychiatrist",
                "child psychologist",
                "childbirth class",
                "children hall",
                "children policlinic",
                "children's cafe",
                "children's camp",
                "children's club",
                "children's hospital",
                "children's store",
                "childrens store",
                "chilean restaurant",
                "chimney services",
                "chimney sweep",
                "chinaware store",
                "chinese bakery",
                "chinese restaurant",
                "chinese supermarket",
                "chinese takeaway",
                "chocolate artisan",
                "chocolate cafe",
                "chocolate factory",
                "chocolate shop",
                "chop bar",
                "chophouse restaurant",
                "christian church",
                "christian college",
                "christmas market",
                "christmas store",
                "chrysler dealer",
                "cider bar",
                "cider mill",
                "cigar shop",
                "citroen dealer",
                "city courthouse",
                "city hall",
                "city park",
                "civic center",
                "civil engineer",
                "civil police",
                "cleaning service",
                "clothes market",
                "clothing manufacturer",
                "clothing shop",
                "clothing store",
                "clothing supplier",
                "clothing wholesaler",
                "co-ed school",
                "coaching center",
                "coaching service",
                "coal exporter",
                "coal supplier",
                "cocktail bar",
                "coffee roasters",
                "coffee shop",
                "coffee stand",
                "coffee store",
                "coffee wholesaler",
                "coffin supplier",
                "coin dealer",
                "collectibles store",
                "colombian restaurant",
                "comedy club",
                "comic cafe",
                "commercial agent",
                "commercial photographer",
                "commercial printer",
                "community center",
                "community college",
                "community garden",
                "community school",
                "company registry",
                "computer club",
                "computer consultant",
                "computer service",
                "computer shop",
                "computer store",
                "computer wholesaler",
                "concert hall",
                "concrete contractor",
                "concrete factory",
                "condiments supplier",
                "condominium complex",
                "confectionery store",
                "confectionery wholesaler",
                "conference center",
                "conservative club",
                "conservative synagogue",
                "consignment shop",
                "construction company",
                "container service",
                "container supplier",
                "container terminal",
                "containers supplier",
                "continental restaurant",
                "convenience store",
                "convention center",
                "cookie shop",
                "cooking class",
                "cooking school",
                "cooling plant",
                "cooperative bank",
                "copper supplier",
                "copy shop",
                "copywriting service",
                "corporate campus",
                "corporate office",
                "cosmetic dentist",
                "cosmetic surgeon",
                "cosmetics industry",
                "cosmetics shop",
                "cosmetics store",
                "cosmetics wholesaler",
                "cosplay cafe",
                "costume store",
                "cottage rental",
                "cottage village",
                "cotton exporter",
                "cotton mill",
                "cotton supplier",
                "countertop contractor",
                "countertop store",
                "country club",
                "country house",
                "country park",
                "courier service",
                "court reporter",
                "couscous restaurant",
                "coworking space",
                "crab house",
                "craft store",
                "cramming school",
                "crane dealer",
                "crane service",
                "craniosacral therapy",
                "credit union",
                "cremation service",
                "creole restaurant",
                "cricket club",
                "cricket ground",
                "cricket shop",
                "croatian restaurant",
                "crop grower",
                "croquet club",
                "cruise agency",
                "cruise terminal",
                "crypto atm",
                "cuban restaurant",
                "culinary school",
                "cultural association",
                "cultural center",
                "cultural landmark",
                "cupcake shop",
                "cupra dealer",
                "curling club",
                "curling hall",
                "curtain store",
                "custom tailor",
                "customs broker",
                "customs consultant",
                "customs office",
                "customs warehouse",
                "cutlery store",
                "cycling park",
                "czech restaurant",
                "dacia dealer",
                "daihatsu dealer",
                "dairy farm",
                "dairy store",
                "dairy supplier",
                "dance club",
                "dance company",
                "dance hall",
                "dance pavillion",
                "dance restaurant",
                "dance school",
                "dance store",
                "danish restaurant",
                "dart bar",
                "dating service",
                "day spa",
                "deaf church",
                "deaf service",
                "debt collecting",
                "decal supplier",
                "deck builder",
                "delivery restaurant",
                "delivery service",
                "demolition contractor",
                "dental clinic",
                "dental hygienist",
                "dental laboratory",
                "dental radiology",
                "dental school",
                "department store",
                "desalination plant",
                "design agency",
                "design engineer",
                "design institute",
                "dessert restaurant",
                "dessert shop",
                "detention center",
                "diabetes center",
                "diagnostic center",
                "dialysis center",
                "diamond buyer",
                "diamond dealer",
                "diaper service",
                "digital printer",
                "dinner theater",
                "dirt supplier",
                "disco club",
                "discount store",
                "discount supermarket",
                "distribution service",
                "district attorney",
                "district justice",
                "district office",
                "dive club",
                "dive shop",
                "diving center",
                "divorce lawyer",
                "divorce service",
                "dj service",
                "do-it-yourself shop",
                "dock builder",
                "dodge dealer",
                "dog breeder",
                "dog cafe",
                "dog park",
                "dog trainer",
                "dog walker",
                "dojo restaurant",
                "doll store",
                "dollar store",
                "domestic airport",
                "dominican restaurant",
                "donations center",
                "donut shop",
                "door manufacturer",
                "door shop",
                "door supplier",
                "door warehouse",
                "drafting service",
                "drainage service",
                "drama school",
                "drawing lessons",
                "dress shop",
                "dress store",
                "drilling contractor",
                "driveshaft shop",
                "driving school",
                "drone shop",
                "drug store",
                "drum school",
                "drum store",
                "dry cleaner",
                "ducati dealer",
                "dude ranch",
                "dumpling restaurant",
                "durum restaurant",
                "dutch restaurant",
                "dvd store",
                "dye store",
                "dynamometer supplier",
                "e-commerce service",
                "eclectic restaurant",
                "ecological park",
                "ecologists association",
                "economic consultant",
                "ecuadorian restaurant",
                "education center",
                "education centre",
                "educational consultant",
                "educational institution",
                "egg supplier",
                "egyptian restaurant",
                "electrical engineer",
                "electrical substation",
                "electronics company",
                "electronics engineer",
                "electronics manufacturer",
                "electronics store",
                "electronics wholesaler",
                "elementary school",
                "elevator manufacturer",
                "elevator service",
                "embossing service",
                "embroidery service",
                "embroidery shop",
                "emdr psychotherapist",
                "emergency room",
                "emergency training",
                "employment agency",
                "employment attorney",
                "employment center",
                "employment consultant",
                "energy supplier",
                "engineering consultant",
                "engineering school",
                "english restaurant",
                "entertainment agency",
                "envelope supplier",
                "environment office",
                "environmental consultant",
                "environmental engineer",
                "environmental organization",
                "episcopal church",
                "equestrian club",
                "equestrian facility",
                "equestrian store",
                "equipment exporter",
                "equipment importer",
                "equipment supplier",
                "eritrean restaurant",
                "erotic massage",
                "escrow service",
                "espresso bar",
                "estate agent",
                "estate appraiser",
                "estate liquidator",
                "ethiopian restaurant",
                "ethnographic museum",
                "european restaurant",
                "evangelical church",
                "evening school",
                "event planner",
                "event venue",
                "excavating contractor",
                "exhibition planner",
                "eyebrow bar",
                "eyelash salon",
                "fabric store",
                "fabric wholesaler",
                "fabrication engineer",
                "facial spa",
                "falafel restaurant",
                "family counselor",
                "family restaurant",
                "farm bureau",
                "farm school",
                "farm shop",
                "farmers' market",
                "farrier service",
                "fashion designer",
                "fast food",
                "fastener supplier",
                "fax service",
                "federal police",
                "feed manufacturer",
                "fence contractor",
                "fencing salon",
                "fencing school",
                "ferrari dealer",
                "ferris wheel",
                "ferry service",
                "fertility clinic",
                "fertility physician",
                "fertilizer supplier",
                "festival hall",
                "fiat dealer",
                "fiberglass supplier",
                "figurine shop",
                "filipino restaurant",
                "filtration plant",
                "finance broker",
                "financial advisor",
                "financial audit",
                "financial consultant",
                "financial institution",
                "financial planner",
                "fingerprinting service",
                "finnish restaurant",
                "fire station",
                "firearms academy",
                "fireplace manufacturer",
                "fireplace store",
                "firewood supplier",
                "fireworks store",
                "fireworks supplier",
                "fish farm",
                "fish processing",
                "fish restaurant",
                "fish spa",
                "fish store",
                "fishing camp",
                "fishing charter",
                "fishing club",
                "fishing pier",
                "fishing pond",
                "fishing store",
                "fitness center",
                "fitness centre",
                "flag store",
                "flamenco school",
                "flamenco theater",
                "flea market",
                "flight school",
                "floating market",
                "flooring contractor",
                "flooring store",
                "floridian restaurant",
                "flour mill",
                "flower delivery",
                "flower designer",
                "flower market",
                "fmcg manufacturer",
                "fondue restaurant",
                "food bank",
                "food broker",
                "food court",
                "food manufacturer",
                "food producer",
                "food store",
                "foot bath",
                "foot care",
                "football club",
                "football field",
                "footwear wholesaler",
                "ford dealer",
                "foreclosure service",
                "foreign consulate",
                "forensic consultant",
                "forestry service",
                "forklift dealer",
                "fountain contractor",
                "foursquare church",
                "franconian restaurant",
                "fraternal organization",
                "free clinic",
                "freestyle wrestling",
                "french restaurant",
                "friends church",
                "fruit parlor",
                "fruit wholesaler",
                "fruits wholesaler",
                "fuel pump",
                "fuel supplier",
                "fugu restaurant",
                "funeral director",
                "funeral home",
                "fur manufacturer",
                "fur service",
                "furnace store",
                "furniture accessories",
                "furniture maker",
                "furniture manufacturer",
                "furniture store",
                "furniture wholesaler",
                "fusion restaurant",
                "futon store",
                "futsal court",
                "galician restaurant",
                "gambling house",
                "gambling instructor",
                "game store",
                "garage builder",
                "garbage dump",
                "garden center",
                "garment exporter",
                "gas company",
                "gas engineer",
                "gas shop",
                "gas station",
                "gasket manufacturer",
                "gastrointestinal surgeon",
                "gated community",
                "gay bar",
                "gay sauna",
                "gazebo builder",
                "general contractor",
                "general hospital",
                "general practitioner",
                "general store",
                "genesis dealer",
                "geological service",
                "georgian restaurant",
                "geotechnical engineer",
                "german restaurant",
                "ghost town",
                "gift shop",
                "gimbap restaurant",
                "girl bar",
                "girls' hostel",
                "glass blower",
                "glass industry",
                "glass manufacturer",
                "glass merchant",
                "glass shop",
                "glassware manufacturer",
                "glassware store",
                "glassware wholesaler",
                "gluten-free restaurant",
                "gmc dealer",
                "goan restaurant",
                "gold dealer",
                "goldfish store",
                "golf club",
                "golf course",
                "golf instructor",
                "golf shop",
                "gospel church",
                "government college",
                "government hospital",
                "government office",
                "government school",
                "gps supplier",
                "graduate school",
                "grain elevator",
                "grammar school",
                "granite supplier",
                "graphic designer",
                "gravel pit",
                "gravel plant",
                "greek restaurant",
                "greyhound stadium",
                "grill store",
                "grocery store",
                "group accommodation",
                "group home",
                "grow shop",
                "guardia civil",
                "guatemalan restaurant",
                "guest house",
                "guitar instructor",
                "guitar store",
                "gujarati restaurant",
                "gun club",
                "gun shop",
                "gutter service",
                "gymnasium school",
                "gymnastics center",
                "gymnastics club",
                "gyro restaurant",
                "hair salon",
                "haitian restaurant",
                "hakka restaurant",
                "halal restaurant",
                "haleem restaurant",
                "halfway house",
                "ham shop",
                "hamburger restaurant",
                "hand surgeon",
                "handbags shop",
                "handball club",
                "handball court",
                "handicraft exporter",
                "handicraft fair",
                "handicraft museum",
                "handicraft school",
                "handicrafts wholesaler",
                "hardware shop",
                "hardware store",
                "harley-davidson dealer",
                "hat shop",
                "haunted house",
                "hawaiian restaurant",
                "hawker stall",
                "hay supplier",
                "health consultant",
                "health counselor",
                "health resort",
                "health spa",
                "heart hospital",
                "heating contractor",
                "height works",
                "helicopter charter",
                "herb shop",
                "heritage building",
                "heritage museum",
                "heritage preservation",
                "heritage railroad",
                "high school",
                "highway patrol",
                "hiking area",
                "hiking guide",
                "hindu priest",
                "hindu temple",
                "hispanic church",
                "historical landmark",
                "historical place",
                "historical society",
                "history museum",
                "hoagie restaurant",
                "hobby store",
                "hockey club",
                "hockey field",
                "hockey rink",
                "holding company",
                "holiday apartment",
                "holiday flat",
                "holiday home",
                "holiday park",
                "home builder",
                "home help",
                "home inspector",
                "homekill service",
                "homeless service",
                "homeless shelter",
                "homeopathic pharmacy",
                "homeowners' association",
                "homewares shop",
                "honda dealer",
                "honduran restaurant",
                "honey farm",
                "hookah bar",
                "hookah store",
                "horse breeder",
                "horse trainer",
                "horseshoe smith",
                "horsestable studfarm",
                "hose supplier",
                "hospital department",
                "host club",
                "house sitter",
                "housing association",
                "housing authority",
                "housing complex",
                "housing cooperative",
                "housing development",
                "housing society",
                "hungarian restaurant",
                "hunting area",
                "hunting club",
                "hunting preserve",
                "hunting store",
                "hvac contractor",
                "hyderabadi restaurant",
                "hydraulic engineer",
                "hypnotherapy service",
                "hyundai dealer",
                "ice supplier",
                "icelandic restaurant",
                "icse school",
                "image consultant",
                "imax theater",
                "immigration attorney",
                "impermeabilization service",
                "incense supplier",
                "incineration plant",
                "indian restaurant",
                "indian takeaway",
                "indonesian restaurant",
                "indoor cycling",
                "indoor lodging",
                "indoor playground",
                "indoor snowcenter",
                "industrial consultant",
                "industrial engineer",
                "industrial supermarket",
                "infiniti dealer",
                "information services",
                "insolvency service",
                "installation service",
                "instrumentation engineer",
                "insulation contractor",
                "insulator supplier",
                "insurance agency",
                "insurance attorney",
                "insurance broker",
                "insurance company",
                "interior decoration",
                "interior decorator",
                "interior designer",
                "international airport",
                "international school",
                "internet cafe",
                "internet shop",
                "investment bank",
                "investment company",
                "investment service",
                "irish pub",
                "irish restaurant",
                "iron works",
                "israeli restaurant",
                "isuzu dealer",
                "italian restaurant",
                "izakaya restaurant",
                "jaguar dealer",
                "jain temple",
                "jamaican restaurant",
                "janitorial service",
                "japanese delicatessen",
                "japanese inn",
                "japanese restaurant",
                "japanese steakhouse",
                "javanese restaurant",
                "jazz club",
                "jeans shop",
                "jeep dealer",
                "jewellery store",
                "jewelry appraiser",
                "jewelry buyer",
                "jewelry designer",
                "jewelry engraver",
                "jewelry exporter",
                "jewelry manufacturer",
                "jewelry store",
                "jewish restaurant",
                "judaica store",
                "judicial auction",
                "judicial scrivener",
                "judo club",
                "judo school",
                "juice shop",
                "jujitsu school",
                "junior college",
                "junk dealer",
                "justice department",
                "jute exporter",
                "jute mill",
                "kabaddi club",
                "kaiseki restaurant",
                "karaoke bar",
                "karate club",
                "karate school",
                "karma dealer",
                "karnataka restaurant",
                "kashmiri restaurant",
                "kazakhstani restaurant",
                "kebab shop",
                "kerala restaurant",
                "kerosene supplier",
                "kia dealer",
                "kickboxing school",
                "kimono store",
                "kitchen remodeler",
                "kitchen renovator",
                "kite shop",
                "knife store",
                "knit shop",
                "knitting instructor",
                "knitwear manufacturer",
                "kofta restaurant",
                "konkani restaurant",
                "korean church",
                "korean restaurant",
                "koshari restaurant",
                "kosher restaurant",
                "kushiyaki restaurant",
                "labor union",
                "ladder supplier",
                "lamborghini dealer",
                "lamination service",
                "lancia dealer",
                "land allotment",
                "land surveyor",
                "landscape architect",
                "landscape designer",
                "landscape gardener",
                "language school",
                "laotian restaurant",
                "lasik surgeon",
                "laundry service",
                "law firm",
                "law library",
                "law school",
                "lawyers association",
                "leagues club",
                "learning center",
                "leasing service",
                "leather exporter",
                "leather wholesaler",
                "lebanese restaurant",
                "lechon restaurant",
                "legal services",
                "leisure centre",
                "lesbian bar",
                "lexus dealer",
                "license bureau",
                "life coach",
                "lighting consultant",
                "lighting contractor",
                "lighting manufacturer",
                "lighting store",
                "ligurian restaurant",
                "limousine service",
                "linens store",
                "lingerie manufacturer",
                "lingerie store",
                "lingerie wholesaler",
                "linoleum store",
                "liquor store",
                "literacy program",
                "lithuanian restaurant",
                "livery company",
                "livestock breeder",
                "livestock dealer",
                "livestock producer",
                "loan agency",
                "lock store",
                "locks supplier",
                "log cabins",
                "logging contractor",
                "logistics service",
                "lombardian restaurant",
                "loss adjuster",
                "lottery retailer",
                "lottery shop",
                "love hotel",
                "lpg conversion",
                "luggage store",
                "luggage wholesaler",
                "lumber store",
                "lunch restaurant",
                "lutheran church",
                "machine construction",
                "machine shop",
                "machine workshop",
                "machining manufacturer",
                "macrobiotic restaurant",
                "madrilian restaurant",
                "magazine store",
                "magic store",
                "mailbox supplier",
                "mailing service",
                "majorcan restaurant",
                "make-up artist",
                "malaysian restaurant",
                "maltese restaurant",
                "mammography service",
                "manado restaurant",
                "management school",
                "mandarin restaurant",
                "manor house",
                "maori organization",
                "map store",
                "mapping service",
                "marathi restaurant",
                "marble contractor",
                "marble supplier",
                "marche restaurant",
                "marine engineer",
                "marine surveyor",
                "maritime museum",
                "market researcher",
                "marketing agency",
                "marketing consultant",
                "marriage celebrant",
                "maserati dealer",
                "masonry contractor",
                "massage parlor",
                "massage school",
                "massage spa",
                "massage therapist",
                "maternity hospital",
                "maternity store",
                "mathematics school",
                "mattress store",
                "mausoleum builder",
                "maybach dealer",
                "mazda dealer",
                "mclaren dealer",
                "meal delivery",
                "meat packer",
                "meat processor",
                "meat wholesaler",
                "mechanical contractor",
                "mechanical engineer",
                "mechanical plant",
                "media company",
                "media consultant",
                "media house",
                "mediation service",
                "medical center",
                "medical centre",
                "medical clinic",
                "medical examiner",
                "medical group",
                "medical laboratory",
                "medical lawyer",
                "medical office",
                "medical school",
                "medical spa",
                "medicine exporter",
                "meditation center",
                "meditation instructor",
                "mediterranean restaurant",
                "mehandi class",
                "mehndi designer",
                "memorial estate",
                "memorial park",
                "men's tailor",
                "mennonite church",
                "mens tailor",
                "mercantile development",
                "mercedes-benz dealer",
                "messianic synagogue",
                "metal fabricator",
                "metal finisher",
                "metal supplier",
                "metal workshop",
                "metallurgy company",
                "metalware dealer",
                "metalware producer",
                "methodist church",
                "mexican restaurant",
                "mg dealer",
                "middle school",
                "military base",
                "military board",
                "military cemetery",
                "military hospital",
                "military school",
                "military town",
                "millwork shop",
                "mini dealer",
                "miniatures store",
                "mining company",
                "mining consultant",
                "mining engineer",
                "mining equipment",
                "mirror shop",
                "mitsubishi dealer",
                "mobile caterer",
                "model shop",
                "modeling agency",
                "modeling school",
                "mold maker",
                "molding supplier",
                "momo restaurant",
                "monogramming service",
                "montessori school",
                "monument maker",
                "moped dealer",
                "moravian church",
                "moroccan restaurant",
                "mortgage broker",
                "mortgage lender",
                "motorcycle dealer",
                "motorcycle shop",
                "motoring club",
                "motorsports store",
                "mountain cabin",
                "mountain peak",
                "mountaineering class",
                "movie studio",
                "movie theater",
                "moving company",
                "mri center",
                "muffler shop",
                "mughlai restaurant",
                "mulch supplier",
                "municipal guard",
                "murtabak restaurant",
                "music college",
                "music conservatory",
                "music instructor",
                "music producer",
                "music publisher",
                "music school",
                "music store",
                "musical club",
                "nail salon",
                "nasi restaurant",
                "national forest",
                "national library",
                "national museum",
                "national park",
                "national reserve",
                "nature preserve",
                "naturopathic practitioner",
                "naval base",
                "navarraise restaurant",
                "neapolitan restaurant",
                "needlework shop",
                "neonatal physician",
                "nepalese restaurant",
                "netball club",
                "news service",
                "newspaper publisher",
                "nicaraguan restaurant",
                "night club",
                "night market",
                "nissan dealer",
                "non-denominational church",
                "non-governmental organization",
                "non-profit organization",
                "noodle shop",
                "norwegian restaurant",
                "notaries association",
                "notary public",
                "notions store",
                "novelties wholesaler",
                "novelty store",
                "nudist club",
                "nudist park",
                "nurse practitioner",
                "nursery school",
                "nursing agency",
                "nursing association",
                "nursing home",
                "nursing school",
                "nut store",
                "nyonya restaurant",
                "oaxacan restaurant",
                "observation deck",
                "occupational therapist",
                "oden restaurant",
                "odia restaurant",
                "oil refinery",
                "okonomiyaki restaurant",
                "oldsmobile dealer",
                "opel dealer",
                "open university",
                "opera company",
                "opera house",
                "ophthalmology clinic",
                "optical wholesaler",
                "oral surgeon",
                "orchid farm",
                "orchid grower",
                "organic farm",
                "organic restaurant",
                "organic shop",
                "orthodox church",
                "orthodox synagogue",
                "orthopedic clinic",
                "orthopedic surgeon",
                "otolaryngology clinic",
                "outdoor bath",
                "outerwear store",
                "outlet mall",
                "outlet store",
                "oyster supplier",
                "paan shop",
                "package locker",
                "packaging company",
                "padang restaurant",
                "padel club",
                "padel court",
                "paint manufacturer",
                "paint store",
                "paintball center",
                "paintball store",
                "painting lessons",
                "painting studio",
                "paintings store",
                "paisa restaurant",
                "pakistani restaurant",
                "palatine restaurant",
                "pallet supplier",
                "pan-asian restaurant",
                "pancake restaurant",
                "panipuri shop",
                "paper distributor",
                "paper exporter",
                "paper mill",
                "paper store",
                "paraguayan restaurant",
                "parking garage",
                "parking grounds",
                "parking lot",
                "parkour spot",
                "parochial school",
                "parsi restaurant",
                "parsi temple",
                "party planner",
                "party store",
                "passport agent",
                "passport office",
                "pasta shop",
                "pastry shop",
                "patent attorney",
                "patent office",
                "paving contractor",
                "pawn shop",
                "payroll service",
                "pedestrian zone",
                "pediatric cardiologist",
                "pediatric clinic",
                "pediatric dentist",
                "pediatric dermatologist",
                "pediatric endocrinologist",
                "pediatric gastroenterologist",
                "pediatric hematologist",
                "pediatric nephrologist",
                "pediatric neurologist",
                "pediatric oncologist",
                "pediatric ophthalmologist",
                "pediatric pulmonologist",
                "pediatric rheumatologist",
                "pediatric surgeon",
                "pediatric urologist",
                "pempek restaurant",
                "pen store",
                "pension office",
                "pentecostal church",
                "perfume store",
                "perinatal center",
                "persian restaurant",
                "personal trainer",
                "peruvian restaurant",
                "pet cemetery",
                "pet groomer",
                "pet shop",
                "pet sitter",
                "pet store",
                "pet trainer",
                "petrol station",
                "peugeot dealer",
                "pharmaceutical company",
                "pharmaceutical lab",
                "philharmonic hall",
                "pho restaurant",
                "photo agency",
                "photo booth",
                "photo lab",
                "photo shop",
                "photography class",
                "photography school",
                "photography service",
                "photography studio",
                "physical therapist",
                "physician assistant",
                "physiotherapy center",
                "piadina restaurant",
                "piano bar",
                "piano instructor",
                "piano maker",
                "piano store",
                "pickleball court",
                "picnic ground",
                "pie shop",
                "piedmontese restaurant",
                "pig farm",
                "pilaf restaurant",
                "pilates studio",
                "pilgrim hostel",
                "pipe supplier",
                "pizza delivery",
                "pizza restaurant",
                "pizza takeaway",
                "pizza takeout",
                "plant nursery",
                "plastic surgeon",
                "plastic wholesaler",
                "plating service",
                "plywood supplier",
                "poke bar",
                "police academy",
                "police department",
                "polish restaurant",
                "polo club",
                "polygraph service",
                "polymer supplier",
                "polynesian restaurant",
                "polytechnic institute",
                "pond contractor",
                "pontiac dealer",
                "pony club",
                "pool hall",
                "popcorn store",
                "porridge restaurant",
                "porsche dealer",
                "port authority",
                "portrait studio",
                "portuguese restaurant",
                "post office",
                "postal code",
                "poster store",
                "pottery classes",
                "pottery manufacturer",
                "pottery store",
                "poultry farm",
                "poultry store",
                "power station",
                "pozole restaurant",
                "prawn fishing",
                "precision engineer",
                "preparatory school",
                "presbyterian church",
                "press advisory",
                "pretzel store",
                "primary school",
                "print shop",
                "private college",
                "private hospital",
                "private investigator",
                "private tutor",
                "private university",
                "probation office",
                "process server",
                "produce market",
                "produce wholesaler",
                "professional association",
                "professional organizer",
                "propane supplier",
                "propeller shop",
                "property consultant",
                "property developer",
                "property investment",
                "property maintenance",
                "protected area",
                "protestant church",
                "provence restaurant",
                "psychiatric hospital",
                "psychomotor therapist",
                "psychopedagogy clinic",
                "public bath",
                "public bathroom",
                "public beach",
                "public housing",
                "public library",
                "public sauna",
                "public university",
                "pueblan restaurant",
                "pump supplier",
                "pumpkin patch",
                "punjabi restaurant",
                "puppet theater",
                "quaker church",
                "quantity surveyor",
                "quilt shop",
                "raclette restaurant",
                "racquetball club",
                "radiator shop",
                "radio broadcaster",
                "rail museum",
                "railing contractor",
                "railroad company",
                "railroad contractor",
                "railway services",
                "rajasthani restaurant",
                "ram dealer",
                "ramen restaurant",
                "real estate",
                "record company",
                "record store",
                "recording studio",
                "recreation center",
                "recycling center",
                "reenactment site",
                "reform synagogue",
                "reformed church",
                "refrigerator store",
                "refugee camp",
                "regional airport",
                "regional council",
                "registration office",
                "registry office",
                "rehabilitation center",
                "rehearsal studio",
                "reiki therapist",
                "religious destination",
                "religious institution",
                "religious lodging",
                "religious organization",
                "religious school",
                "renault dealer",
                "renovation contractor",
                "repair service",
                "reptile store",
                "research engineer",
                "research foundation",
                "research institute",
                "residential college",
                "residents association",
                "resort hotel",
                "rest stop",
                "resume service",
                "retirement community",
                "retirement home",
                "retreat center",
                "rice mill",
                "rice restaurant",
                "rice shop",
                "rice wholesaler",
                "river port",
                "road cycling",
                "rock climbing",
                "rock shop",
                "roller coaster",
                "roman restaurant",
                "romanian restaurant",
                "roofing contractor",
                "roofing service",
                "rowing area",
                "rowing club",
                "rsl club",
                "rug store",
                "rugby club",
                "rugby field",
                "rugby store",
                "running store",
                "russian restaurant",
                "rv dealer",
                "rv park",
                "saab dealer",
                "sailing club",
                "sailing school",
                "sake brewery",
                "salad shop",
                "salsa bar",
                "salsa classes",
                "salvadoran restaurant",
                "salvage dealer",
                "salvage yard",
                "samba school",
                "sambo school",
                "sand plant",
                "sandblasting service",
                "sandwich shop",
                "sanitary inspection",
                "sanitation service",
                "sardinian restaurant",
                "saree shop",
                "sashimi restaurant",
                "satay restaurant",
                "saturn dealer",
                "sauna club",
                "sauna store",
                "savings bank",
                "saw mill",
                "scale supplier",
                "scandinavian restaurant",
                "scenic spot",
                "scenography company",
                "school cafeteria",
                "school center",
                "school house",
                "science museum",
                "scottish restaurant",
                "scout hall",
                "scout home",
                "scrapbooking store",
                "screen printer",
                "screen store",
                "screw supplier",
                "scuba instructor",
                "sculpture museum",
                "seafood farm",
                "seafood market",
                "seafood restaurant",
                "seafood wholesaler",
                "seal shop",
                "seaplane base",
                "seat dealer",
                "seblak restaurant",
                "secondary school",
                "security service",
                "seed supplier",
                "self-catering accommodation",
                "self-storage facility",
                "serbian restaurant",
                "service establishment",
                "serviced accommodation",
                "serviced apartment",
                "sewing company",
                "sewing shop",
                "seychelles restaurant",
                "sfiha restaurant",
                "shanghainese restaurant",
                "sharpening service",
                "shawarma restaurant",
                "shed builder",
                "sheep shearer",
                "sheltered housing",
                "shelving store",
                "shinto shrine",
                "shipping company",
                "shipping service",
                "shochu brewery",
                "shoe factory",
                "shoe shop",
                "shoe store",
                "shogi lesson",
                "shooting range",
                "shopping centre",
                "shopping mall",
                "shredding service",
                "shrimp farm",
                "sichuan restaurant",
                "sicilian restaurant",
                "siding contractor",
                "sign shop",
                "signwriting service",
                "silk store",
                "singaporean restaurant",
                "singles organization",
                "skate shop",
                "skateboard shop",
                "skating instructor",
                "ski club",
                "ski resort",
                "ski school",
                "ski shop",
                "skittle club",
                "skoda dealer",
                "skydiving center",
                "skylight contractor",
                "sleep clinic",
                "smart dealer",
                "smart shop",
                "smoke shop",
                "snack bar",
                "snowboard shop",
                "snowmobile dealer",
                "soccer club",
                "soccer field",
                "soccer practice",
                "soccer store",
                "social club",
                "social worker",
                "sod supplier",
                "sofa store",
                "softball club",
                "softball field",
                "software company",
                "soondae restaurant",
                "soto restaurant",
                "soup kitchen",
                "soup restaurant",
                "soup shop",
                "souvenir manufacturer",
                "souvenir store",
                "spa garden",
                "spanish restaurant",
                "special educator",
                "specialized clinic",
                "specialized hospital",
                "speech pathologist",
                "sperm bank",
                "spice exporter",
                "spice store",
                "spice wholesaler",
                "spices exporter",
                "spiritist center",
                "sports bar",
                "sports club",
                "sports complex",
                "sports school",
                "sportswear store",
                "sportwear manufacturer",
                "spring supplier",
                "squash club",
                "squash court",
                "stair contractor",
                "stamp shop",
                "stand bar",
                "state archive",
                "state park",
                "state parliament",
                "state police",
                "stationery manufacturer",
                "stationery store",
                "stationery wholesaler",
                "std clinic",
                "steak house",
                "steamboat restaurant",
                "steel distributor",
                "steel erector",
                "steel fabricator",
                "sticker manufacturer",
                "stitching class",
                "stock broker",
                "stone carving",
                "stone cutter",
                "stone supplier",
                "storage facility",
                "structural engineer",
                "stucco contractor",
                "student dormitory",
                "student union",
                "studying center",
                "subaru dealer",
                "subway station",
                "sugar factory",
                "sugar shack",
                "sukiyaki restaurant",
                "sunblind supplier",
                "sundae restaurant",
                "sundanese restaurant",
                "sunglasses store",
                "sunroom contractor",
                "superannuation consultant",
                "superfund site",
                "support group",
                "surf school",
                "surf shop",
                "surgical center",
                "surgical oncologist",
                "surinamese restaurant",
                "surplus store",
                "sushi restaurant",
                "sushi takeaway",
                "suzuki dealer",
                "swabian restaurant",
                "swedish restaurant",
                "swim club",
                "swimming basin",
                "swimming competition",
                "swimming facility",
                "swimming instructor",
                "swimming lake",
                "swimming pool",
                "swimming school",
                "swimwear store",
                "swiss restaurant",
                "syrian restaurant",
                "t-shirt store",
                "tabascan restaurant",
                "tacaca restaurant",
                "tack shop",
                "taco restaurant",
                "taekwondo school",
                "taiwanese restaurant",
                "takeout restaurant",
                "takoyaki restaurant",
                "talent agency",
                "tamale shop",
                "tanning salon",
                "taoist temple",
                "tapas bar",
                "tapas restaurant",
                "tatami store",
                "tattoo artist",
                "tattoo shop",
                "tax assessor",
                "tax attorney",
                "tax consultant",
                "tax department",
                "tax preparation",
                "taxi service",
                "taxi stand",
                "taxicab stand",
                "tb clinic",
                "tea exporter",
                "tea house",
                "tea manufacturer",
                "tea store",
                "tea wholesaler",
                "teachers college",
                "technical school",
                "technical university",
                "technology museum",
                "technology park",
                "tegal restaurant",
                "telecommunication school",
                "telecommunications contractor",
                "telecommunications engineer",
                "telemarketing service",
                "telephone company",
                "telephone exchange",
                "telescope store",
                "television station",
                "temaki restaurant",
                "temp agency",
                "tenant ownership",
                "tennis club",
                "tennis court",
                "tennis instructor",
                "tennis store",
                "teppanyaki restaurant",
                "tesla showroom",
                "tex-mex restaurant",
                "textile engineer",
                "textile exporter",
                "textile merchant",
                "textile mill",
                "thai restaurant",
                "theater company",
                "theater production",
                "theme park",
                "thermal baths",
                "thread supplier",
                "thrift store",
                "thuringian restaurant",
                "tibetan restaurant",
                "tiffin center",
                "tiki bar",
                "tile contractor",
                "tile manufacturer",
                "tile store",
                "timeshare agency",
                "tire service",
                "tire shop",
                "title company",
                "toast restaurant",
                "tobacco shop",
                "tobacco supplier",
                "tofu restaurant",
                "tofu shop",
                "toiletries store",
                "toll station",
                "tongue restaurant",
                "tonkatsu restaurant",
                "tool manufacturer",
                "tool store",
                "tool wholesaler",
                "topography company",
                "topsoil supplier",
                "tortilla shop",
                "tour agency",
                "tour operator",
                "tourist attraction",
                "towing service",
                "townhouse complex",
                "toy library",
                "toy manufacturer",
                "toy museum",
                "toy store",
                "toyota dealer",
                "tractor dealer",
                "trade school",
                "traditional market",
                "traditional teahouse",
                "traffic officer",
                "trailer dealer",
                "trailer manufacturer",
                "train depot",
                "train station",
                "train yard",
                "training center",
                "training centre",
                "training consultant",
                "training provider",
                "tram stop",
                "transcription service",
                "transit depot",
                "transit station",
                "transit stop",
                "translation service",
                "transmission shop",
                "transplant surgeon",
                "transport hub",
                "transportation service",
                "travel agency",
                "travel agent",
                "travel clinic",
                "travel lounge",
                "tree farm",
                "tree service",
                "trial attorney",
                "tribal headquarters",
                "trophy shop",
                "truck dealer",
                "truck farmer",
                "truck stop",
                "trucking company",
                "truss manufacturer",
                "trust bank",
                "tunisian restaurant",
                "turf supplier",
                "turkish restaurant",
                "turkmen restaurant",
                "tuscan restaurant",
                "tutoring service",
                "tuxedo shop",
                "typewriter supplier",
                "typing service",
                "tyre manufacturer",
                "ukrainian restaurant",
                "unagi restaurant",
                "underwear store",
                "unemployment office",
                "uniform store",
                "unity church",
                "university department",
                "university hospital",
                "university library",
                "upholstery shop",
                "urology clinic",
                "uruguayan restaurant",
                "utility contractor",
                "valencian restaurant",
                "vaporizer store",
                "variety store",
                "vascular surgeon",
                "vastu consultant",
                "vegan restaurant",
                "vegetable wholesaler",
                "vegetarian restaurant",
                "vehicle exporter",
                "vehicle repair",
                "venetian restaurant",
                "venezuelan restaurant",
                "veterans center",
                "veterans hospital",
                "veterans organization",
                "veterinary care",
                "veterinary pharmacy",
                "video arcade",
                "video karaoke",
                "video store",
                "vietnamese restaurant",
                "village hall",
                "vineyard church",
                "violin shop",
                "visitor center",
                "vocal instructor",
                "vocational school",
                "volkswagen dealer",
                "volleyball club",
                "volleyball court",
                "volleyball instructor",
                "volunteer organization",
                "volvo dealer",
                "waldorf kindergarten",
                "waldorf school",
                "walk-in clinic",
                "wallpaper installer",
                "wallpaper store",
                "war museum",
                "warehouse club",
                "warehouse store",
                "watch manufacturer",
                "watch store",
                "water mill",
                "water park",
                "water works",
                "waterbed store",
                "waterproofing service",
                "wax museum",
                "wax supplier",
                "weaving mill",
                "web designer",
                "website designer",
                "wedding bakery",
                "wedding buffet",
                "wedding chapel",
                "wedding photographer",
                "wedding planner",
                "wedding service",
                "wedding store",
                "wedding venue",
                "weigh station",
                "weightlifting area",
                "wellness center",
                "wellness hotel",
                "wellness program",
                "welsh restaurant",
                "wesleyan church",
                "western restaurant",
                "wheel store",
                "wheelchair store",
                "wholesale bakery",
                "wholesale drugstore",
                "wholesale florist",
                "wholesale grocer",
                "wholesale jeweler",
                "wholesale market",
                "wi-fi spot",
                "wicker store",
                "wig shop",
                "wildlife park",
                "wildlife refuge",
                "wind farm",
                "window supplier",
                "windsurfing store",
                "wine bar",
                "wine cellar",
                "wine club",
                "wine store",
                "wok restaurant",
                "wood supplier",
                "wool store",
                "wrestling school",
                "x-ray lab",
                "yacht broker",
                "yacht club",
                "yakiniku restaurant",
                "yakisoba restaurant",
                "yakitori restaurant",
                "yarn store",
                "yemeni restaurant",
                "yoga instructor",
                "yoga studio",
                "youth center",
                "youth club",
                "youth hostel",
                "youth organization",
                "yucatan restaurant",
                "3d printing service",
                "aboriginal art gallery",
                "abundant life church",
                "acrobatic diving pool",
                "addiction treatment center",
                "adult dvd store",
                "adult education school",
                "adult entertainment club",
                "adult entertainment store",
                "adventure sports center",
                "aerated drinks supplier",
                "aerial sports center",
                "aero dance class",
                "african goods store",
                "after school program",
                "agricultural high school",
                "agricultural machinery manufacturer",
                "agricultural product wholesaler",
                "air compressor supplier",
                "air conditioning contractor",
                "air conditioning store",
                "air filter supplier",
                "air force base",
                "airbrushing supply store",
                "aircraft maintenance company",
                "aircraft rental service",
                "aircraft supply store",
                "airline ticket agency",
                "airport shuttle service",
                "alcohol retail monopoly",
                "alcoholic beverage wholesaler",
                "alcoholism treatment program",
                "alfa romeo dealer",
                "alternative fuel station",
                "alternative medicine clinic",
                "alternative medicine practitioner",
                "aluminum frames supplier",
                "american grocery store",
                "amish furniture store",
                "amusement machine supplier",
                "amusement park ride",
                "amusement ride supplier",
                "angler fish restaurant",
                "animal control service",
                "animal feed store",
                "animal protection organization",
                "animal rescue service",
                "animal watering hole",
                "antique furniture store",
                "apartment rental agency",
                "appliance parts supplier",
                "appliance rental service",
                "appliance repair service",
                "appliances customer service",
                "architectural salvage store",
                "armed forces association",
                "aromatherapy supply store",
                "art restoration service",
                "art supply store",
                "artificial plant supplier",
                "asbestos testing service",
                "asian fusion restaurant",
                "asian grocery store",
                "asphalt mixing plant",
                "assisted living facility",
                "association / organization",
                "aston martin dealer",
                "attorney referral service",
                "atv rental service",
                "atv repair shop",
                "audio visual consultant",
                "australian goods store",
                "auto accessories wholesaler",
                "auto body shop",
                "auto bodywork mechanic",
                "auto chemistry shop",
                "auto electrical service",
                "auto glass shop",
                "auto insurance agency",
                "auto machine shop",
                "auto parts manufacturer",
                "auto parts market",
                "auto parts store",
                "auto repair shop",
                "auto restoration service",
                "auto rickshaw stand",
                "auto spring shop",
                "auto sunroof shop",
                "auto tag agency",
                "automobile storage facility",
                "aviation training institute",
                "ayam penyet restaurant",
                "baby clothing store",
                "baby swimming school",
                "bail bonds service",
                "baking supply store",
                "ballroom dance instructor",
                "banking and finance",
                "bar stool supplier",
                "barber supply store",
                "baseball goods store",
                "basketball court contractor",
                "bathroom supply store",
                "batik clothing store",
                "batting cage center",
                "beach cleaning service",
                "beach clothing store",
                "beach entertainment shop",
                "beach volleyball club",
                "beach volleyball court",
                "beauty product supplier",
                "beauty products wholesaler",
                "beauty supply store",
                "bed & breakfast",
                "bedroom furniture store",
                "bee relocation service",
                "bicycle rental service",
                "bicycle repair shop",
                "bike sharing station",
                "bikram yoga studio",
                "billiards supply store",
                "bird control service",
                "bird watching area",
                "birth certificate service",
                "birth control center",
                "blast cleaning service",
                "blood donation center",
                "blood testing service",
                "bmw motorcycle dealer",
                "board game club",
                "board of education",
                "boat accessories supplier",
                "boat cleaning service",
                "boat cover supplier",
                "boat detailing service",
                "boat rental service",
                "boat repair shop",
                "boat storage facility",
                "boat tour agency",
                "boat trailer dealer",
                "bocce ball court",
                "body piercing shop",
                "body shaping class",
                "bonsai plant supplier",
                "boot repair shop",
                "border crossing station",
                "bottled water supplier",
                "bouncy castle hire",
                "bowling supply shop",
                "box lunch supplier",
                "boys' high school",
                "bpo placement agency",
                "brewing supply store",
                "bubble tea store",
                "buddhist supplies store",
                "building materials market",
                "building materials store",
                "building materials supplier",
                "building restoration service",
                "bungee jumping center",
                "burglar alarm store",
                "bus ticket agency",
                "bus tour agency",
                "business administration service",
                "business banking service",
                "business development service",
                "business management consultant",
                "business networking company",
                "butane gas supplier",
                "butcher shop deli",
                "cabin rental agency",
                "calvary chapel church",
                "camera repair shop",
                "camper shell supplier",
                "cancer treatment center",
                "cane furniture store",
                "cape verdean restaurant",
                "car accessories store",
                "car alarm supplier",
                "car battery store",
                "car detailing service",
                "car inspection station",
                "car leasing service",
                "car rental agency",
                "car sharing location",
                "car stereo store",
                "career guidance service",
                "carpet cleaning service",
                "carriage ride service",
                "cat boarding service",
                "cell phone store",
                "central american restaurant",
                "central european restaurant",
                "central heating service",
                "central javanese restaurant",
                "certified public accountant",
                "chamber of agriculture",
                "chamber of commerce",
                "chamber of handicrafts",
                "champon noodle restaurant",
                "check cashing service",
                "chicken wings restaurant",
                "child care agency",
                "children's amusement center",
                "children's clothing store",
                "children's furniture store",
                "children's party buffet",
                "children's party service",
                "chinese language instructor",
                "chinese language school",
                "chinese medicine clinic",
                "chinese medicine store",
                "chinese noodle restaurant",
                "chinese tea house",
                "christian book store",
                "christmas tree farm",
                "church of christ",
                "church supply store",
                "cig kofte restaurant",
                "cinema equipment supplier",
                "citizen information bureau",
                "city district office",
                "city employment department",
                "city government office",
                "city tax office",
                "civil engineering company",
                "civil examinations academy",
                "civil law attorney",
                "cleaning products supplier",
                "clock repair service",
                "closed circuit television",
                "clothing alteration service",
                "coast guard station",
                "coffee machine supplier",
                "coffee vending machine",
                "coin operated locker",
                "cold cut store",
                "cold noodle restaurant",
                "cold storage facility",
                "college of agriculture",
                "comic book store",
                "commercial refrigerator supplier",
                "commissioner for oaths",
                "community health centre",
                "comprehensive secondary school",
                "computer accessories store",
                "computer desk store",
                "computer hardware manufacturer",
                "computer networking service",
                "computer repair service",
                "computer security service",
                "computer software store",
                "computer training school",
                "concrete product supplier",
                "condominium rental agency",
                "conservatory of music",
                "construction equipment supplier",
                "construction machine dealer",
                "construction material wholesaler",
                "consumer advice center",
                "contact lenses supplier",
                "contemporary louisiana restaurant",
                "convention information bureau",
                "copier repair service",
                "copying supply store",
                "corporate gift supplier",
                "cosmetic products manufacturer",
                "cost accounting service",
                "costa rican restaurant",
                "costume jewelry shop",
                "costume rental service",
                "country food restaurant",
                "county government office",
                "court executive officer",
                "crane rental agency",
                "credit counseling service",
                "credit reporting agency",
                "crime victim service",
                "criminal justice attorney",
                "crushed stone supplier",
                "cured ham bar",
                "cured ham store",
                "cured ham warehouse",
                "currency exchange service",
                "custom home builder",
                "custom label printer",
                "custom t-shirt store",
                "cycle rickshaw stand",
                "dart supply store",
                "data entry service",
                "data recovery service",
                "database management company",
                "day care center",
                "debris removal service",
                "debt collection agency",
                "delivery chinese restaurant",
                "dental implants periodontist",
                "dental implants provider",
                "dental insurance agency",
                "dental supply store",
                "denture care center",
                "department of housing",
                "department of transportation",
                "desktop publishing service",
                "diabetes equipment supplier",
                "diesel engine dealer",
                "diesel fuel supplier",
                "digital printing service",
                "dim sum restaurant",
                "direct mail advertising",
                "disability equipment supplier",
                "disc golf course",
                "display stand manufacturer",
                "disposable tableware supplier",
                "distance learning center",
                "district government office",
                "dj supply store",
                "dogsled ride service",
                "doll restoration service",
                "doner kebab restaurant",
                "double glazing installer",
                "drafting equipment supplier",
                "dried flower shop",
                "dried seafood store",
                "drilling equipment supplier",
                "drinking water fountain",
                "driver's license office",
                "driving test center",
                "drug testing service",
                "dry fruit store",
                "dry ice supplier",
                "dry wall contractor",
                "ds automobiles dealer",
                "dump truck dealer",
                "dumpster rental service",
                "duty free store",
                "e commerce agency",
                "ear piercing service",
                "earth works company",
                "east african restaurant",
                "east javanese restaurant",
                "eastern european restaurant",
                "eastern orthodox church",
                "economic development agency",
                "educational supply store",
                "educational testing service",
                "eftpos equipment supplier",
                "elder law attorney",
                "electric bicycle store",
                "electric generator shop",
                "electric motor store",
                "electric motorcycle dealer",
                "electric utility company",
                "electrical appliance wholesaler",
                "electrical equipment supplier",
                "electrical installation service",
                "electrical products wholesaler",
                "electrical repair shop",
                "electrical supply store",
                "electronic engineering service",
                "electronic parts supplier",
                "electronics accessories wholesaler",
                "electronics hire shop",
                "electronics repair shop",
                "electronics vending machine",
                "emergency care physician",
                "emergency care service",
                "emergency dental service",
                "emergency locksmith service",
                "emergency training school",
                "emergency veterinarian service",
                "engine rebuilding service",
                "english language camp",
                "english language school",
                "environmental health service",
                "environmental protection organization",
                "equipment rental agency",
                "escape room center",
                "estate planning attorney",
                "event management company",
                "event technology service",
                "event ticket seller",
                "executive search firm",
                "exercise equipment store",
                "extended stay hotel",
                "eye care center",
                "fabric product manufacturer",
                "factory equipment supplier",
                "faculty of law",
                "faculty of pharmacy",
                "faculty of science",
                "family law attorney",
                "family planning center",
                "family planning counselor",
                "family practice physician",
                "family service center",
                "farm equipment supplier",
                "farm household tour",
                "fashion accessories shop",
                "fashion accessories store",
                "fashion design school",
                "fast food restaurant",
                "federal credit union",
                "federal government office",
                "felt boots store",
                "fence supply store",
                "feng shui consultant",
                "feng shui shop",
                "fiberglass repair service",
                "filipino grocery store",
                "film production company",
                "fine dining restaurant",
                "finishing materials supplier",
                "fire alarm supplier",
                "fire fighters academy",
                "fire protection consultant",
                "fire protection service",
                "first aid station",
                "fitness equipment wholesaler",
                "fitted furniture supplier",
                "flamenco dance store",
                "floor refinishing service",
                "fmcg goods wholesaler",
                "foam rubber producer",
                "foam rubber supplier",
                "folk high school",
                "food and drink",
                "food machinery supplier",
                "food manufacturing supply",
                "food processing company",
                "food processing equipment",
                "food products supplier",
                "food seasoning manufacturer",
                "foot massage parlor",
                "foreign trade consultant",
                "foreman builders association",
                "forklift rental service",
                "formal wear store",
                "fortune telling services",
                "foster care service",
                "free parking lot",
                "freight forwarding service",
                "french language school",
                "french steakhouse restaurant",
                "fresh food market",
                "fried chicken takeaway",
                "frozen dessert supplier",
                "frozen food manufacturer",
                "frozen food store",
                "frozen yogurt shop",
                "full gospel church",
                "function room facility",
                "funeral celebrant service",
                "fur coat shop",
                "furnace parts supplier",
                "furnace repair service",
                "furnished apartment building",
                "furniture accessories supplier",
                "furniture rental service",
                "furniture repair shop",
                "garage door supplier",
                "garbage collection service",
                "garden building supplier",
                "garden machinery supplier",
                "gas cylinders supplier",
                "gas installation service",
                "gas logs supplier",
                "gay night club",
                "general education school",
                "general practice attorney",
                "geological research company",
                "german language school",
                "gift basket store",
                "gift wrap store",
                "girls' high school",
                "glass block supplier",
                "glass cutting service",
                "glass etching service",
                "glass repair service",
                "glasses repair service",
                "gold mining company",
                "golf cart dealer",
                "golf course builder",
                "golf driving range",
                "gourmet grocery store",
                "government economic program",
                "government ration shop",
                "graffiti removal service",
                "greek orthodox church",
                "green energy supplier",
                "greeting card shop",
                "grocery delivery service",
                "gutter cleaning service",
                "gypsum product supplier",
                "hair extension technician",
                "hair extensions supplier",
                "hair removal service",
                "hair replacement service",
                "hair transplantation clinic",
                "handicapped transportation service",
                "hang gliding center",
                "haute french restaurant",
                "hawaiian goods store",
                "head start center",
                "health food restaurant",
                "health food store",
                "health insurance agency",
                "hearing aid store",
                "heating equipment supplier",
                "heating oil supplier",
                "helicopter tour agency",
                "helium gas supplier",
                "herbal medicine store",
                "high ropes course",
                "higher secondary school",
                "historical place museum",
                "hiv testing center",
                "hockey supply store",
                "holiday apartment rental",
                "holistic medicine practitioner",
                "home audio store",
                "home automation company",
                "home cinema installation",
                "home furniture shop",
                "home goods store",
                "home improvement store",
                "home insurance agency",
                "home staging service",
                "home theater store",
                "horse boarding stable",
                "horse rental service",
                "horse riding field",
                "horse riding school",
                "horse trailer dealer",
                "horseback riding service",
                "hospitality high school",
                "hot bedstone spa",
                "hot dog restaurant",
                "hot dog stand",
                "hot pot restaurant",
                "hot tub store",
                "hotel management school",
                "hotel supply store",
                "house cleaning service",
                "house clearance service",
                "house sitter agency",
                "houseboat rental service",
                "household chemicals supplier",
                "household goods wholesaler",
                "housing utility company",
                "hua gong shop",
                "hub cap supplier",
                "human resource consulting",
                "hydraulic equipment supplier",
                "hydraulic repair service",
                "hydroelectric power plant",
                "hydroponics equipment supplier",
                "hygiene articles wholesaler",
                "hyperbaric medicine physician",
                "ice cream shop",
                "ice hockey club",
                "ice skating club",
                "ice skating instructor",
                "ice skating rink",
                "ikan bakar restaurant",
                "import export company",
                "indian grocery store",
                "indian motorcycle dealer",
                "indian muslim restaurant",
                "indian sizzler restaurant",
                "indian sweets shop",
                "indoor golf course",
                "indoor swimming pool",
                "industrial chemicals wholesaler",
                "industrial design company",
                "industrial engineers association",
                "industrial equipment supplier",
                "industrial gas supplier",
                "infectious disease physician",
                "institute of technology",
                "insulation materials store",
                "intellectual property registry",
                "interior architect office",
                "interior construction contractor",
                "interior fitting contractor",
                "interior plant service",
                "internal medicine ward",
                "international trade consultant",
                "internet marketing service",
                "internet service provider",
                "invitation printing service",
                "irish goods store",
                "iron ware dealer",
                "irrigation equipment supplier",
                "italian grocery store",
                "janitorial equipment supplier",
                "japanese confectionery shop",
                "japanese curry restaurant",
                "japanese grocery store",
                "japanese language instructor",
                "japanese regional restaurant",
                "japanese sweets restaurant",
                "japanese-style business hotel",
                "japanized western restaurant",
                "jewelry equipment supplier",
                "jewelry repair service",
                "junk removal service",
                "juvenile detention center",
                "kalle pache restaurant",
                "kawasaki motorcycle dealer",
                "key duplication service",
                "kitchen furniture store",
                "kitchen supply store",
                "korean barbecue restaurant",
                "korean beef restaurant",
                "korean grocery store",
                "korean rib restaurant",
                "kosher grocery store",
                "kung fu school",
                "labor relations attorney",
                "laboratory equipment supplier",
                "ladies' clothes shop",
                "laminating equipment supplier",
                "lamp repair service",
                "lamp shade supplier",
                "land planning authority",
                "land reform institute",
                "land rover dealer",
                "land surveying office",
                "landscape lighting designer",
                "landscaping supply store",
                "laser cutting service",
                "laser equipment supplier",
                "laser tag center",
                "latin american restaurant",
                "law book store",
                "lawn bowls club",
                "lawn care service",
                "lawn mower store",
                "leather cleaning service",
                "leather coats store",
                "leather goods manufacturer",
                "leather goods store",
                "leather goods supplier",
                "leather goods wholesaler",
                "leather repair service",
                "legal affairs bureau",
                "life insurance agency",
                "light bulb supplier",
                "lighting products wholesaler",
                "line marking service",
                "little league club",
                "little league field",
                "live music bar",
                "live music venue",
                "livestock auction house",
                "local government office",
                "local history museum",
                "local medical services",
                "log home builder",
                "lost property office",
                "luggage repair service",
                "luggage storage facility",
                "lymph drainage therapist",
                "machine knife supplier",
                "machine maintenance service",
                "machine repair service",
                "machinery parts manufacturer",
                "mailbox rental service",
                "mailing machine supplier",
                "main customs office",
                "manufactured home transporter",
                "marine supply store",
                "marquee hire service",
                "marriage license bureau",
                "martial arts club",
                "martial arts school",
                "masonry supply store",
                "massage supply store",
                "match box manufacturer",
                "measuring instruments supplier",
                "meat dish restaurant",
                "meat products store",
                "medical billing service",
                "medical book store",
                "medical certificate service",
                "medical equipment manufacturer",
                "medical equipment supplier",
                "medical supply store",
                "medical technology manufacturer",
                "medical transcription service",
                "meeting planning service",
                "men's clothes shop",
                "men's clothing store",
                "men's health physician",
                "mental health clinic",
                "mental health service",
                "metal construction company",
                "metal industry suppliers",
                "metal machinery supplier",
                "metal polishing service",
                "metal processing company",
                "metal stamping service",
                "metal working shop",
                "metaphysical supply store",
                "metropolitan train company",
                "mexican goods store",
                "mexican grocery store",
                "mexican torta restaurant",
                "middle eastern restaurant",
                "military recruiting office",
                "milk delivery service",
                "mineral water company",
                "miniature golf course",
                "minibus taxi service",
                "ministry of education",
                "miso cutlet restaurant",
                "missing persons organization",
                "mobile disco service",
                "mobile home dealer",
                "mobile home park",
                "mobile money agent",
                "mobile network operator",
                "mobile phone shop",
                "mobility equipment supplier",
                "model design company",
                "model portfolio studio",
                "model train store",
                "modern art museum",
                "modern british restaurant",
                "modern european restaurant",
                "modern french restaurant",
                "modern indian restaurant",
                "modern izakaya restaurant",
                "modular home builder",
                "modular home dealer",
                "money order service",
                "money transfer service",
                "mongolian barbecue restaurant",
                "motor scooter dealer",
                "motor vehicle dealer",
                "motorcycle driving school",
                "motorcycle insurance agency",
                "motorcycle parts store",
                "motorcycle rental agency",
                "motorcycle repair shop",
                "mountain cable car",
                "movie rental kiosk",
                "movie rental store",
                "moving supply store",
                "municipal administration office",
                "museum of zoology",
                "music box store",
                "musical instrument manufacturer",
                "musical instrument store",
                "musician and composer",
                "mutton barbecue restaurant",
                "nasi goreng restaurant",
                "nasi uduk restaurant",
                "native american restaurant",
                "natural goods store",
                "natural history museum",
                "natural stone exporter",
                "natural stone supplier",
                "natural stone wholesaler",
                "neon sign shop",
                "new age church",
                "new american restaurant",
                "new england restaurant",
                "new zealand restaurant",
                "newspaper distribution service",
                "non vegetarian restaurant",
                "north african restaurant",
                "north indian restaurant",
                "northern italian restaurant",
                "nuclear power company",
                "nuclear power plant",
                "nuevo latino restaurant",
                "occupational health service",
                "occupational medical physician",
                "off roading area",
                "offal barbecue restaurant",
                "office accessories wholesaler",
                "office equipment supplier",
                "office furniture store",
                "office refurbishment service",
                "office supply store",
                "office supply wholesaler",
                "offset printing service",
                "oil change service",
                "olive oil cooperative",
                "olive oil manufacturer",
                "open air museum",
                "optical products manufacturer",
                "organic drug store",
                "organic food store",
                "oriental goods store",
                "oriental medicine clinic",
                "oriental medicine store",
                "oriental rug store",
                "orthopedic shoe store",
                "orthopedic supplies store",
                "outboard motor store",
                "outdoor activity organiser",
                "outdoor equestrian facility",
                "outdoor furniture store",
                "outdoor sports store",
                "outdoor swimming pool",
                "oxygen cocktail spot",
                "oxygen equipment supplier",
                "oyster bar restaurant",
                "pacific rim restaurant",
                "packaging supply store",
                "pain control clinic",
                "pain management physician",
                "paint stripping service",
                "painter and decorator",
                "paper bag supplier",
                "paralegal services provider",
                "park and garden",
                "park and ride",
                "passport photo processor",
                "paternity testing service",
                "patients support association",
                "patio enclosure supplier",
                "paving materials supplier",
                "pecel lele restaurant",
                "pennsylvania dutch restaurant",
                "performing arts group",
                "performing arts theater",
                "permanent make-up clinic",
                "personal chef service",
                "personal injury attorney",
                "personal injury lawyer",
                "personal watercraft dealer",
                "pest control service",
                "pet adoption service",
                "pet boarding service",
                "pet care service",
                "pet moving service",
                "pet supply store",
                "petroleum products company",
                "pharmaceutical products wholesaler",
                "phone repair service",
                "photo restoration service",
                "physical examination center",
                "physical fitness program",
                "physical rehabilitation center",
                "physical therapy clinic",
                "physician referral service",
                "physiotherapy equipment supplier",
                "piano moving service",
                "piano repair service",
                "piano tuning service",
                "picture frame shop",
                "pinball machine supplier",
                "pine furniture shop",
                "place of worship",
                "plast window store",
                "plastic bag supplier",
                "plastic bags wholesaler",
                "plastic fabrication company",
                "plastic products supplier",
                "plastic products wholesaler",
                "plastic resin manufacturer",
                "plastic surgery clinic",
                "playground equipment supplier",
                "plumbing supply store",
                "pneumatic tools supplier",
                "police supply store",
                "political party office",
                "pond fish supplier",
                "pond supply store",
                "pony ride service",
                "pool billard club",
                "pool cleaning service",
                "port operating company",
                "portable building manufacturer",
                "portable toilet supplier",
                "powder coating service",
                "power plant consultant",
                "powersports vehicle dealer",
                "practitioner service location",
                "pregnancy care center",
                "pressure washing service",
                "printed music publisher",
                "printer repair service",
                "printing equipment supplier",
                "private educational institution",
                "private equity firm",
                "private golf course",
                "private sector bank",
                "promotional products supplier",
                "property administration service",
                "property investment company",
                "property management company",
                "protective clothing supplier",
                "psychoneurological specialized clinic",
                "psychosomatic medical practitioner",
                "public defender's office",
                "public educational institution",
                "public golf course",
                "public health department",
                "public medical center",
                "public parking space",
                "public prosecutors office",
                "public relations firm",
                "public safety office",
                "public sector bank",
                "public swimming pool",
                "public works department",
                "puerto rican restaurant",
                "pvc windows supplier",
                "race car dealer",
                "radiator repair service",
                "raft trip outfitter",
                "railroad equipment supplier",
                "railroad ties supplier",
                "rainwater tank supplier",
                "rare book store",
                "raw food restaurant",
                "real estate agency",
                "real estate agent",
                "real estate appraiser",
                "real estate attorney",
                "real estate auctioneer",
                "real estate consultant",
                "real estate developer",
                "real estate school",
                "real estate surveyor",
                "records storage facility",
                "recycling drop-off location",
                "refrigerated transport service",
                "refrigerator repair service",
                "regional government office",
                "registered general nurse",
                "religious book store",
                "religious goods store",
                "renter's insurance agency",
                "reproductive health clinic",
                "restaurant or cafe",
                "restaurant supply store",
                "retaining wall supplier",
                "rice cake shop",
                "rice cracker shop",
                "road construction company",
                "road safety town",
                "rock climbing gym",
                "rock climbing instructor",
                "rock music club",
                "roller skating club",
                "roller skating rink",
                "roofing supply store",
                "roommate referral service",
                "rubber products supplier",
                "rubber stamp store",
                "rugby league club",
                "russian grocery store",
                "russian orthodox church",
                "rustic furniture store",
                "rv detailing service",
                "rv repair shop",
                "rv storage facility",
                "rv supply store",
                "safety equipment supplier",
                "sailing event area",
                "satellite communication service",
                "saw sharpening service",
                "scaffolding rental service",
                "scale model club",
                "scale repair service",
                "school administration office",
                "school bus service",
                "school district office",
                "school supply store",
                "scientific equipment supplier",
                "scooter rental service",
                "scooter repair shop",
                "scrap metal dealer",
                "screen printing shop",
                "screen repair service",
                "scuba tour agency",
                "seasonal goods store",
                "second hand store",
                "security guard service",
                "security system supplier",
                "self defense school",
                "self service restaurant",
                "self storage facility",
                "semi conductor supplier",
                "senior citizen center",
                "senior high school",
                "septic system service",
                "seventh-day adventist church",
                "sewage disposal service",
                "sewage treatment plant",
                "sewing machine store",
                "sheet metal contractor",
                "sheet music store",
                "shipping equipment industry",
                "shoe repair shop",
                "shoe shining service",
                "shooting event area",
                "shower door shop",
                "sightseeing tour agency",
                "silk plant shop",
                "singing telegram service",
                "sixth form college",
                "skate sharpening service",
                "skeet shooting range",
                "ski rental service",
                "ski repair service",
                "skin care clinic",
                "small plates restaurant",
                "smart car dealer",
                "smog inspection station",
                "snow removal service",
                "snowboard rental service",
                "snowmobile rental service",
                "soba noodle shop",
                "social security attorney",
                "social security office",
                "social services organization",
                "social welfare center",
                "societe de flocage",
                "soft drinks shop",
                "software training institute",
                "soil testing service",
                "solar energy company",
                "solid fuel company",
                "solid waste engineer",
                "soto ayam restaurant",
                "soul food restaurant",
                "south african restaurant",
                "south american restaurant",
                "south asian restaurant",
                "south indian restaurant",
                "south sulawesi restaurant",
                "southeast asian restaurant",
                "southern italian restaurant",
                "southern restaurant (us)",
                "soy sauce maker",
                "space of remembrance",
                "special education school",
                "sport tour agency",
                "sporting goods store",
                "sports accessories wholesaler",
                "sports activity location",
                "sports card store",
                "sports injury clinic",
                "sports massage therapist",
                "sports medicine clinic",
                "sports medicine physician",
                "sports memorabilia store",
                "sports nutrition store",
                "sri lankan restaurant",
                "stained glass studio",
                "stainless steel plant",
                "stall installation service",
                "stamp collectors club",
                "staple food package",
                "state employment department",
                "state government office",
                "state liquor store",
                "state owned farm",
                "std testing service",
                "steamed bun shop",
                "steel construction company",
                "steel framework contractor",
                "steelwork design service",
                "stereo rental store",
                "stereo repair service",
                "stock exchange building",
                "store equipment supplier",
                "stores and shopping",
                "student housing center",
                "students parents association",
                "students support association",
                "suburban train line",
                "summer camp organizer",
                "summer toboggan run",
                "super public bath",
                "supplementary educational institute",
                "surf lifesaving club",
                "surgical products wholesaler",
                "surgical supply store",
                "suzuki motorcycle dealer",
                "swimming pool contractor",
                "table tennis club",
                "table tennis facility",
                "tai chi school",
                "tata motors dealer",
                "tattoo removal service",
                "tax collector's office",
                "tax preparation service",
                "tea market place",
                "teeth whitening service",
                "telecommunications equipment supplier",
                "telecommunications service provider",
                "telephone answering service",
                "television repair service",
                "tent rental service",
                "thai massage therapist",
                "theater supply store",
                "theatrical costume supplier",
                "tile cleaning service",
                "tire repair shop",
                "toner cartridge supplier",
                "tool rental service",
                "tool repair shop",
                "tourist information center",
                "towing equipment provider",
                "tractor repair shop",
                "trading card store",
                "traditional american restaurant",
                "traditional costume club",
                "traditional kostume store",
                "trailer rental service",
                "trailer repair shop",
                "trailer supply store",
                "train repairing center",
                "train ticket agency",
                "transportation escort service",
                "triumph motorcycle dealer",
                "tropical fish store",
                "truck accessories store",
                "truck parts supplier",
                "truck rental agency",
                "truck repair shop",
                "truck topper supplier",
                "tsukigime parking lot",
                "tune up supplier",
                "typewriter repair service",
                "udon noodle restaurant",
                "unfinished furniture store",
                "unitarian universalist church",
                "united methodist church",
                "upholstery cleaning service",
                "urban planning department",
                "urgent care center",
                "used appliance store",
                "used bicycle shop",
                "used book store",
                "used car dealer",
                "used cd store",
                "used clothing store",
                "used computer store",
                "used furniture store",
                "used game store",
                "used motorcycle dealer",
                "used tire shop",
                "used truck dealer",
                "utility trailer dealer",
                "uyghur cuisine restaurant",
                "vacuum cleaner store",
                "valet parking service",
                "van rental agency",
                "vcr repair service",
                "vegetable wholesale market",
                "vehicle inspection service",
                "vehicle repair shop",
                "vehicle shipping agent",
                "vehicle wrapping service",
                "vending machine supplier",
                "ventilating equipment manufacturer",
                "venture capital company",
                "veterans affairs department",
                "video conferencing service",
                "video duplication service",
                "video editing service",
                "video game store",
                "video production service",
                "vintage clothing store",
                "vinyl sign shop",
                "virtual office rental",
                "visa consulting service",
                "vocational gymnasium school",
                "vocational secondary school",
                "voter registration office",
                "waste management service",
                "waste transfer station",
                "watch repair service",
                "water cooler supplier",
                "water filter supplier",
                "water polo pool",
                "water pump supplier",
                "water purification company",
                "water ski shop",
                "water skiing club",
                "water skiing instructor",
                "water skiing service",
                "water testing service",
                "water treatment plant",
                "water treatment supplier",
                "water utility company",
                "waterbed repair service",
                "weather forecast service",
                "web hosting company",
                "wedding souvenir shop",
                "weight loss service",
                "welding gas supplier",
                "welding supply store",
                "well drilling contractor",
                "west african restaurant",
                "western apparel store",
                "wheel alignment service",
                "wheelchair rental service",
                "wheelchair repair service",
                "wholesale food store",
                "wholesale plant nursery",
                "wholesaler household appliances",
                "wildlife rescue service",
                "willow basket manufacturer",
                "wind turbine builder",
                "window cleaning service",
                "window installation service",
                "window tinting service",
                "window treatment store",
                "wine storage facility",
                "winemaking supply store",
                "wing chun school",
                "women's clothing store",
                "women's health clinic",
                "women's personal trainer",
                "wood frame supplier",
                "wood stove shop",
                "wood working class",
                "woodworking supply store",
                "work clothes store",
                "yamaha motorcycle dealer",
                "yoga retreat center",
                "youth care service",
                "youth clothing store",
                "adult day care center",
                "adult foster care service",
                "air compressor repair service",
                "air conditioning repair service",
                "air conditioning system supplier",
                "air duct cleaning service",
                "antique furniture restoration service",
                "asian household goods store",
                "assemblies of god church",
                "audio visual equipment supplier",
                "audiovisual equipment rental service",
                "auto air conditioning service",
                "auto body parts supplier",
                "auto care products store",
                "auto dent removal service",
                "auto glass repair service",
                "auto radiator repair service",
                "auto tune up service",
                "auto window tinting service",
                "balloon ride tour agency",
                "bar restaurant furniture store",
                "beauty products vending machine",
                "building equipment hire service",
                "business to business service",
                "cake decorating equipment shop",
                "canoe & kayak store",
                "canoe and kayak club",
                "car security system installer",
                "cardiovascular and thoracic surgeon",
                "carport and pergola builder",
                "cash and carry wholesaler",
                "cell phone accessory store",
                "cell phone charging station",
                "chess and card club",
                "child health care centre",
                "church of the nazarene",
                "city department of transportation",
                "classified ads newspaper publisher",
                "clock and watch maker",
                "clothes and fabric manufacturer",
                "clothes and fabric wholesaler",
                "clothing wholesale market place",
                "coach and minibus hire",
                "commercial real estate agency",
                "commercial real estate inspector",
                "compressed natural gas station",
                "computer support and services",
                "concrete metal framework supplier",
                "construction machine rental service",
                "conveyor belt sushi restaurant",
                "curtain supplier and maker",
                "custom confiscated goods store",
                "dairy farm equipment supplier",
                "dan dan noodle restaurant",
                "dealer of fiat professional",
                "department of motor vehicles",
                "department of public safety",
                "department of social services",
                "diesel engine repair service",
                "disciples of christ church",
                "dog day care center",
                "domestic abuse treatment center",
                "drivers license training school",
                "dry wall supply store",
                "dryer vent cleaning service",
                "eating disorder treatment center",
                "electric motor repair shop",
                "electric motor scooter dealer",
                "electric motor vehicle dealer",
                "electric vehicle charging station",
                "electrolysis hair removal service",
                "energy equipment and solutions",
                "environment renewable natural resources",
                "executive suite rental agency",
                "exhibition and trade centre",
                "family day care service",
                "farm equipment repair service",
                "farming and cattle raising",
                "fiber optic products supplier",
                "film and photograph library",
                "fire damage restoration service",
                "fire department equipment supplier",
                "fire protection equipment supplier",
                "fire protection system supplier",
                "fish & chips restaurant",
                "fish and chips takeaway",
                "food and beverage consultant",
                "food and beverage exporter",
                "foreign exchange students organization",
                "foreign languages program school",
                "fruit and vegetable processing",
                "fruit and vegetable store",
                "fruit and vegetable wholesaler",
                "full dress rental service",
                "glass & mirror shop",
                "ground self defense force",
                "guardia di finanza police",
                "haute couture fashion house",
                "health and beauty shop",
                "hearing aid repair service",
                "hearing assistance earphone store",
                "hip hop dance class",
                "home health care service",
                "home help service agency",
                "hospital equipment and supplies",
                "hospitality and tourism school",
                "hot tub repair service",
                "hot water system supplier",
                "hua niao market place",
                "hunting and fishing store",
                "ice cream equipment supplier",
                "immigration & naturalization service",
                "income protection insurance agency",
                "income tax help association",
                "industrial real estate agency",
                "industrial technical engineers association",
                "industrial vacuum equipment supplier",
                "iron and steel store",
                "japanese cheap sweets shop",
                "karaoke equipment rental service",
                "kilt shop and hire",
                "kushiage and kushikatsu restaurant",
                "laser hair removal service",
                "lawn equipment rental service",
                "lawn irrigation equipment supplier",
                "lawn mower repair service",
                "lawn sprinkler system contractor",
                "learner driver training area",
                "license plate frames supplier",
                "low income housing program",
                "marine self defense force",
                "marriage or relationship counselor",
                "martial arts supply store",
                "material handling equipment supplier",
                "medical diagnostic imaging center",
                "metal detecting equipment supplier",
                "metal heat treating service",
                "microwave oven repair service",
                "mobile home rental agency",
                "mobile home supply store",
                "mobile phone repair shop",
                "model car play area",
                "motor scooter repair shop",
                "moving and storage service",
                "muay thai boxing gym",
                "municipal department of tourism",
                "museum of space history",
                "music management and promotion",
                "musical instrument rental service",
                "musical instrument repair shop",
                "native american goods store",
                "natural rock climbing area",
                "non smoking holiday home",
                "north eastern indian restaurant",
                "occupational safety and health",
                "off track betting shop",
                "office equipment rental service",
                "office equipment repair service",
                "office space rental agency",
                "oil field equipment supplier",
                "olive oil bottling company",
                "optical instrument repair service",
                "oral and maxillofacial surgeon",
                "orthotics & prosthetics service",
                "paper shredding machine supplier",
                "parking lot for bicycles",
                "parking lot for motorcycles",
                "party equipment rental service",
                "pay by weight restaurant",
                "plant and machinery hire",
                "plastic injection molding service",
                "plus size clothing store",
                "power plant equipment supplier",
                "printer ink refill store",
                "professional and hobby associations",
                "qing fang market place",
                "racing car parts store",
                "ready mix concrete supplier",
                "real estate rental agency",
                "recreational vehicle rental agency",
                "research and product development",
                "retail space rental agency",
                "rolled metal products supplier",
                "safe & vault shop",
                "sand & gravel supplier",
                "sand and gravel supplier",
                "school for the deaf",
                "screen printing supply store",
                "security system installation service",
                "self service car wash",
                "self service health station",
                "sewing machine repair service",
                "shipbuilding and repair company",
                "shipping and mailing service",
                "shop supermarket furniture store",
                "single sex secondary school",
                "small appliance repair service",
                "small claims assistance service",
                "small engine repair service",
                "social security financial department",
                "solar energy equipment supplier",
                "solar energy system service",
                "solar panel maintenance service",
                "solar photovoltaic power plant",
                "south east asian restaurant",
                "spa and health club",
                "sports equipment rental service",
                "stage lighting equipment supplier",
                "state office of education",
                "student career counseling office",
                "study at home school",
                "sweets and dessert buffet",
                "swimming pool repair service",
                "swimming pool supply store",
                "syokudo and teishoku restaurant",
                "table tennis supply store",
                "tattoo and piercing shop",
                "tea and coffee shop",
                "tennis court construction company",
                "threads and yarns wholesaler",
                "tool & die shop",
                "trade fair construction company",
                "united church of canada",
                "united church of christ",
                "used auto parts store",
                "used musical instrument store",
                "used office furniture store",
                "used store fixture supplier",
                "vacation home rental agency",
                "vacuum cleaner repair shop",
                "vacuum cleaning system supplier",
                "vegetarian cafe and deli",
                "video camera repair service",
                "video conferencing equipment supplier",
                "video equipment repair service",
                "video game rental kiosk",
                "video game rental store",
                "visa and passport office",
                "vitamin & supplements store",
                "washer & dryer store",
                "water damage restoration service",
                "water jet cutting service",
                "water softening equipment supplier",
                "water tank cleaning service",
                "water works equipment supplier",
                "waxing hair removal service",
                "wedding dress rental service",
                "whale watching tour agency",
                "wildlife and safari park",
                "wine wholesaler and importer",
                "wood floor installation service",
                "wood floor refinishing service",
                "youth social services organization",
                "architectural and engineering model maker",
                "army & navy surplus shop",
                "audio visual equipment repair service",
                "canoe & kayak tour agency",
                "car finance and loan company",
                "car repair and maintenance service",
                "catering food and drink supplier",
                "coin operated laundry equipment supplier",
                "combined primary and secondary school",
                "disability services and support organization",
                "dress and tuxedo rental service",
                "electric vehicle charging station contractor",
                "electronics retail and repair shop",
                "federal agency for technical relief",
                "flavours fragrances and aroma supplier",
                "floor sanding and polishing service",
                "ice cream and drink shop",
                "industrial spares and products wholesaler",
                "institute of geography and statistics",
                "multimedia and electronic book publisher",
                "oil & natural gas company",
                "oil and gas exploration service",
                "organ donation and tissue bank",
                "outdoor clothing and equipment shop",
                "pet food and animal feeds",
                "pick your own farm produce",
                "polythene and plastic sheeting supplier",
                "road construction machine repair service",
                "sheepskin and wool products supplier",
                "short term apartment rental agency",
                "skin care products vending machine",
                "solar hot water system supplier",
                "sukiyaki and shabu shabu restaurant",
                "united states armed forces base",
                "washer & dryer repair service",
                "water sports equipment rental service",
                "wood and laminate flooring supplier",
                "aboriginal and torres strait islander organisation",
                "hong kong style fast food restaurant",
                "roads ports and canals engineers association",
                "church of jesus christ of latter-day saints"
              ]
            }
          },
          "searchMatching": {
            "title": "Get exact name matches (no similar results)($)",
            "enum": [
              "all",
              "only_includes",
              "only_exact"
            ],
            "type": "string",
            "description": "Restrict what places are scraped based on matching their name with provided 🔍 <b>Search term</b>. E.g., all places that have <b>chicken</b> in their name vs. places called <b>Kentucky Fried Chicken</b>.",
            "default": "all"
          },
          "placeMinimumStars": {
            "title": "Set a minimum star rating ($)",
            "enum": [
              "",
              "two",
              "twoAndHalf",
              "three",
              "threeAndHalf",
              "four",
              "fourAndHalf"
            ],
            "type": "string",
            "description": "Scrape only places with a rating equal to or above the selected stars. Places without reviews will also be skipped. Keep in mind, filtering by reviews reduces the number of places found per credit spent, as many will be excluded.",
            "default": ""
          },
          "website": {
            "title": "Scrape places with/without a website($)",
            "enum": [
              "allPlaces",
              "withWebsite",
              "withoutWebsite"
            ],
            "type": "string",
            "description": "Use this to exclude places without a website, or vice versa. This option is turned off by default.",
            "default": "allPlaces"
          },
          "skipClosedPlaces": {
            "title": "⏩ Skip closed places ($)",
            "type": "boolean",
            "description": "Skip places that are marked as temporary or permanently closed. Ideal for focusing on currently open places.",
            "default": false
          },
          "scrapePlaceDetailPage": {
            "title": "Scrape place detail page ($)",
            "type": "boolean",
            "description": "Scrape detail pages of each place the Actor finds. This will slow down the Actor since it needs to open another page for each place individually.<br><br> The fields available only when scrapePlaceDetailPage is enabled include: `reviewsDistribution`, `imageCategories`, popularTimes fields, `openingHours`, `BusinessConfirmationText`, `peopleAlsoSearch`, `reviewsTags`, `updatesFromCustomers`, `questionsAndAnswers`, `tableReservationLinks`, `orderBy`, `ownerUpdates`, and hotel fields. <br><br>This option needs to be enabled if you wish to use any of the options below.",
            "default": false
          },
          "scrapeTableReservationProvider": {
            "title": "Scrape table reservation provider data ($)",
            "type": "boolean",
            "description": "Scrape table reservation provider data like name, address, email or phone. This data is present only in restaurants that have blue \"RESERVE A TABLE\" button",
            "default": false
          },
          "includeWebResults": {
            "title": "🌐 Include \"Web results\" ($)",
            "type": "boolean",
            "description": "Extract the \"Web results\" section located at the bottom of every place listing.",
            "default": false
          },
          "scrapeDirectories": {
            "title": "🛍 Scrape inside places (e.g. malls or shopping center) ($)",
            "type": "boolean",
            "description": "Some places (e.g. malls) can have multiple businesses located inside them. This option will scrape inside the \"Directory\" or \"At this place\" as per different categories (example <a href='https://www.google.com/maps/place/Forum+Karlín/@50.0914263,14.4522411,532m/data=!3m1!1e3!4m7!3m6!1s0x470b94a14fd738ff:0x6a75e391416ab4fa!8m2!3d50.0914263!4d14.454816!10e3!16s%2Fg%2F1ptxlz77_?entry=ttu&g_ep=EgoyMDI1MDQwMi4xIKXMDSoASAFQAw%3D%3D'>here</a>). Turn this toggle on to include those places in your results.<br><br> ⚠️ Note that that full place details needs to be scraped in order to scrape directories.",
            "default": false
          },
          "maxQuestions": {
            "title": "Number of questions to extract ($)",
            "minimum": 0,
            "type": "integer",
            "description": "Set the number of questions per place you expect to scrape. If you fill in <b>0</b> or leave the field empty, only the first question and answer will be scraped. To extract all questions, type <b>999</b> into the field.<br><br>⚠️ Note that some of the fields contain <b>personal data</b>.",
            "default": 0
          },
          "scrapeContacts": {
            "title": "⏩ Add-on: Company contacts enrichment (from website)",
            "type": "boolean",
            "description": "Enrich Google Maps places with contact details extracted from the business website, including business emails and social media profiles (Meta, LinkedIn, X, etc). Price is charged per place at $2 per 1000 places that have a website. <br><br>We exclude contacts of big chains: mcdonalds, starbucks, dominos, pizzahut, burgerking, kfc, subway, wendys, dunkindonuts, tacobell.",
            "default": false
          },
          "maximumLeadsEnrichmentRecords": {
            "title": "⏩ Add-on: Extract business leads information - Maximum leads per place",
            "type": "integer",
            "description": "Enrich your results with detailed contact and company information, including employee names, job titles, emails, phone numbers, LinkedIn profiles, and key company data like industry and number of employees. <br><br> This setting allows you to set the maximum number of leads records you want to scrape per each place found on the map (that has a website). By default, it's set to 0 which means that no leads information will be scraped. <br><br>⚠️ Note that some of the fields contain <b>personal data</b>. GDPR protects personal data in the European Union and by other regulations around the world. You should not scrape personal data unless you have a legitimate reason to do so. If you're unsure whether your use case is legitimate, please consult an attorney. <br><br>We exclude leads of big chains as these are not related to the local places: mcdonalds, starbucks, dominos, pizzahut, burgerking, kfc, subway, wendys, dunkindonuts, tacobell.",
            "default": 0
          },
          "leadsEnrichmentDepartments": {
            "title": "Leads departments selection",
            "type": "array",
            "description": "You can use this filter to include only specific departments (like Sales, Marketing, or C-Suite). Note: This will only work if the ⏩ Add-on: Extract business leads information - Maximum leads per place (maximumLeadsEnrichmentRecords) option is enabled. Please note that some job titles are sometimes miscategorized in the wrong departments.",
            "items": {
              "type": "string",
              "enum": [
                "c_suite",
                "product",
                "engineering_technical",
                "design",
                "education",
                "finance",
                "human_resources",
                "information_technology",
                "legal",
                "marketing",
                "medical_health",
                "operations",
                "sales",
                "consulting"
              ],
              "enumTitles": [
                "C-Suite",
                "Product",
                "Engineering & Technical",
                "Design",
                "Education",
                "Finance",
                "Human Resources",
                "Information Technology",
                "Legal",
                "Marketing",
                "Medical & Health",
                "Operations",
                "Sales",
                "Consulting"
              ]
            }
          },
          "maxReviews": {
            "title": "Number of reviews to extract ($)",
            "minimum": 0,
            "type": "integer",
            "description": "Set the number of reviews you expect to get per place, priced at 0.5 per thousand reviews, plus an additional charge of $0.002 per place when scraping reviews, since the Scraper triggers the Extra place details scraped event for each place. To extract all reviews, <b>leave this field empty</b>. <br> <br>Each output place item can contain maximum 5,000 reviews so in case more reviews are extracted, a duplicate place is stored with the next 5,000 reviews and so on. <br>⚠️ Enabling this feature might slow the search down.",
            "default": 0
          },
          "reviewsStartDate": {
            "title": "Extract only reviews posted after [date]",
            "pattern": "^(\\d{4})-(0[1-9]|1[0-2])-(0[1-9]|[12]\\d|3[01])(T[0-2]\\d:[0-5]\\d(:[0-5]\\d)?(\\.\\d+)?Z?)?$|^(\\d+)\\s*(minute|hour|day|week|month|year)s?$",
            "type": "string",
            "description": "Either absolute date (e.g. `2024-05-03`) or relative date from now into the past (e.g. `8 days`, `3 months`). JSON input also supports adding time in both absolute (ISO standard, e.g. `2024-05-03T20:00:00`) and relative  (e.g. `3 hours`) formats. Absolute time is always interpreted in the UTC timezone, not your local timezone - please convert accordingly. Supported relative date & time units: `minutes`, `hours`, `days`, `weeks`, `months`, `years`. <br><br> ⚠️ Heads up: If this parameter is specified, you must choose the 'Newest' sort by value. The reason for this is that with this parameter entered, the actor stops scraping reviews as soon as it finds the first review that's older than the specified date. If the sorting is not set to 'Newest', it might encounter a review older than the specified date before it reaches the desired review count and not scrape the desired amount of reviews."
          },
          "reviewsSort": {
            "title": "Sort reviews by",
            "enum": [
              "newest",
              "mostRelevant",
              "highestRanking",
              "lowestRanking"
            ],
            "type": "string",
            "description": "Define the order in which reviews should be sorted.",
            "default": "newest"
          },
          "reviewsFilterString": {
            "title": "Filter reviews by keywords",
            "type": "string",
            "description": "If you enter keywords, only reviews containing those keywords will be scraped. Leave it blank to scrape all reviews.",
            "default": ""
          },
          "reviewsOrigin": {
            "title": "Reviews origin",
            "enum": [
              "all",
              "google"
            ],
            "type": "string",
            "description": "Select whether you want all reviews (from Google, Tripadvisor, etc.) or only reviews from Google",
            "default": "all"
          },
          "scrapeReviewsPersonalData": {
            "title": "🧛‍♂️ Include reviewers' data",
            "type": "boolean",
            "description": "This setting allows you to get personal data about the reviewer (their ID, name, URL, and photo URL) and about review (ID and URL). <br><br>⚠️ Personal data is protected by the GDPR in the European Union and by other regulations around the world. You should not scrape personal data unless you have a legitimate reason to do so. If you're unsure whether your reason is legitimate, consult your lawyers.",
            "default": true
          },
          "maxImages": {
            "title": "Number of additional images to extract ($)",
            "minimum": 0,
            "type": "integer",
            "description": "Set the number of images per place you expect to scrape. Please note that there is an additional charge of $0.002 per place when scraping images, since the Scraper triggers the Extra place details scraped event for each place. To extract all images, <b>leave this field empty</b>. The higher the number, the slower the search."
          },
          "scrapeImageAuthors": {
            "title": "🧑‍🎨 Include the image authors",
            "type": "boolean",
            "description": "Include the author name for each image. <br><br>⚠️ Enabling this toggle may slow down processing as it requires fetching information for each image individually.",
            "default": false
          },
          "countryCode": {
            "title": "🗺 Country",
            "enum": [
              "",
              "us",
              "af",
              "al",
              "dz",
              "as",
              "ad",
              "ao",
              "ai",
              "aq",
              "ag",
              "ar",
              "am",
              "aw",
              "au",
              "at",
              "az",
              "bs",
              "bh",
              "bd",
              "bb",
              "by",
              "be",
              "bz",
              "bj",
              "bm",
              "bt",
              "bo",
              "ba",
              "bw",
              "bv",
              "br",
              "io",
              "bn",
              "bg",
              "bf",
              "bi",
              "kh",
              "cm",
              "ca",
              "cv",
              "ky",
              "cf",
              "td",
              "cl",
              "cn",
              "cx",
              "cc",
              "co",
              "km",
              "cg",
              "cd",
              "ck",
              "cr",
              "ci",
              "hr",
              "cu",
              "cy",
              "cz",
              "dk",
              "dj",
              "dm",
              "do",
              "ec",
              "eg",
              "sv",
              "gq",
              "er",
              "ee",
              "et",
              "fk",
              "fo",
              "fj",
              "fi",
              "fr",
              "gf",
              "pf",
              "tf",
              "ga",
              "gm",
              "ge",
              "de",
              "gh",
              "gi",
              "gr",
              "gl",
              "gd",
              "gp",
              "gu",
              "gt",
              "gn",
              "gw",
              "gy",
              "ht",
              "hm",
              "va",
              "hn",
              "hk",
              "hu",
              "is",
              "in",
              "id",
              "ir",
              "iq",
              "ie",
              "il",
              "it",
              "jm",
              "jp",
              "jo",
              "kz",
              "ke",
              "ki",
              "kp",
              "kr",
              "kw",
              "kg",
              "la",
              "lv",
              "lb",
              "ls",
              "lr",
              "ly",
              "li",
              "lt",
              "lu",
              "mo",
              "mk",
              "mg",
              "mw",
              "my",
              "mv",
              "ml",
              "mt",
              "mh",
              "mq",
              "mr",
              "mu",
              "yt",
              "mx",
              "fm",
              "md",
              "mc",
              "mn",
              "me",
              "ms",
              "ma",
              "mz",
              "mm",
              "na",
              "nr",
              "np",
              "nl",
              "an",
              "nc",
              "nz",
              "ni",
              "ne",
              "ng",
              "nu",
              "nf",
              "mp",
              "no",
              "om",
              "pk",
              "pw",
              "ps",
              "pa",
              "pg",
              "py",
              "pe",
              "ph",
              "pn",
              "pl",
              "pt",
              "pr",
              "qa",
              "re",
              "ro",
              "ru",
              "rw",
              "sh",
              "kn",
              "lc",
              "pm",
              "vc",
              "ws",
              "sm",
              "st",
              "sa",
              "sn",
              "rs",
              "sc",
              "sl",
              "sg",
              "sk",
              "si",
              "sb",
              "so",
              "za",
              "gs",
              "ss",
              "es",
              "lk",
              "sd",
              "sr",
              "sj",
              "sz",
              "se",
              "ch",
              "sy",
              "tw",
              "tj",
              "tz",
              "th",
              "tl",
              "tg",
              "tk",
              "to",
              "tt",
              "tn",
              "tr",
              "tm",
              "tc",
              "tv",
              "ug",
              "ua",
              "ae",
              "gb",
              "um",
              "uy",
              "uz",
              "vu",
              "ve",
              "vn",
              "vg",
              "vi",
              "wf",
              "eh",
              "ye",
              "zm",
              "zw"
            ],
            "type": "string",
            "description": "Set the country where the data extraction should be carried out, e.g., <b>United States</b>."
          },
          "city": {
            "title": "🌇 City",
            "type": "string",
            "description": "Enter the city where the data extraction should be carried out, e.g., <b>Pittsburgh</b>.<br><br>⚠️ <b>Do not include State or Country names here.</b><br><br>⚠️ Automatic City polygons may be smaller than expected (e.g., they don't include agglomeration areas). If you need that, set up the location using Country, State, County, City, or Postal code.<br>For an even more precise location definition (, head over to <b>🛰 Custom search area</b> section to create polygon shapes of the areas you want to scrape."
          },
          "state": {
            "title": "State",
            "type": "string",
            "description": "Set a state where the data extraction should be carried out, e.g., <b>Massachusetts</b> (mainly for the US addresses)."
          },
          "county": {
            "title": "County",
            "type": "string",
            "description": "Set the county where the data extraction should be carried out.<br><br>⚠️ Note that <b>county</b> may represent different administrative areas in different countries: a county (e.g., US), regional district (e.g., Canada) or département (e.g., France)."
          },
          "postalCode": {
            "title": "Postal code",
            "type": "string",
            "description": "Set the postal code of the area where the data extraction should be carried out, e.g., <b>10001</b>. <br><br>⚠️ <b>Combine Postal code only with 🗺 Country, never with 🌇 City. You can only input one postal code at a time.</b>"
          },
          "customGeolocation": {
            "title": "🛰 Custom search area (coordinate order must be: [↕ longitude, ↔ latitude])",
            "type": "object",
            "description": "Use this field to define the exact search area if other search area parameters don't work for you. See <a href='https://apify.com/compass/crawler-google-places#custom-search-area' target='_blank' rel='noopener'>readme</a> or <a href='https://blog.apify.com/google-places-api-limits/#1-create-a-custom-area-by-using-pairs-of-coordinates-%F0%9F%93%A1' target='_blank' rel='noopener'>our guide</a> for details."
          },
          "startUrls": {
            "title": "Google Maps URLs",
            "type": "array",
            "description": "Max 300 results per search URL. Valid format for URLs contains <code>google.com/maps/</code>. This feature also supports uncommon URL formats such as: <code>google.com?cid=***</code>, <code>goo.gl/maps</code>, and custom place list URL.",
            "items": {
              "type": "object",
              "required": [
                "url"
              ],
              "properties": {
                "url": {
                  "type": "string",
                  "title": "URL of a web page",
                  "format": "uri"
                }
              }
            }
          },
          "placeIds": {
            "title": "🗃 Place IDs",
            "type": "array",
            "description": "List of place IDs. You can add place IDs one by one or upload a list using the <strong>Bulk edit</strong> option. <b>Place ID</b> has format `ChIJreV9aqYWdkgROM_boL6YbwA`",
            "items": {
              "type": "string"
            }
          },
          "allPlacesNoSearchAction": {
            "title": "Scrape all places",
            "enum": [
              "",
              "all_places_no_search_ocr",
              "all_places_no_search_mouse"
            ],
            "type": "string",
            "description": "Extract all places visible on the map. Use the <b>Override zoom level</b> parameter to select the level of detail. Higher zoom will scrape more places but will take longer to finish. You can test what place pins are visible with a specific zoom by changing the <a href=\"https://www.google.com/maps/@40.745204,-73.9390184,16z\">16z</a> part of the Google Maps URL.",
            "default": ""
          }
        }
      },
      "runsResponseSchema": {
        "type": "object",
        "properties": {
          "data": {
            "type": "object",
            "properties": {
              "id": {
                "type": "string"
              },
              "actId": {
                "type": "string"
              },
              "userId": {
                "type": "string"
              },
              "startedAt": {
                "type": "string",
                "format": "date-time",
                "example": "2025-01-08T00:00:00.000Z"
              },
              "finishedAt": {
                "type": "string",
                "format": "date-time",
                "example": "2025-01-08T00:00:00.000Z"
              },
              "status": {
                "type": "string",
                "example": "READY"
              },
              "meta": {
                "type": "object",
                "properties": {
                  "origin": {
                    "type": "string",
                    "example": "API"
                  },
                  "userAgent": {
                    "type": "string"
                  }
                }
              },
              "stats": {
                "type": "object",
                "properties": {
                  "inputBodyLen": {
                    "type": "integer",
                    "example": 2000
                  },
                  "rebootCount": {
                    "type": "integer",
                    "example": 0
                  },
                  "restartCount": {
                    "type": "integer",
                    "example": 0
                  },
                  "resurrectCount": {
                    "type": "integer",
                    "example": 0
                  },
                  "computeUnits": {
                    "type": "integer",
                    "example": 0
                  }
                }
              },
              "options": {
                "type": "object",
                "properties": {
                  "build": {
                    "type": "string",
                    "example": "latest"
                  },
                  "timeoutSecs": {
                    "type": "integer",
                    "example": 300
                  },
                  "memoryMbytes": {
                    "type": "integer",
                    "example": 1024
                  },
                  "diskMbytes": {
                    "type": "integer",
                    "example": 2048
                  }
                }
              },
              "buildId": {
                "type": "string"
              },
              "defaultKeyValueStoreId": {
                "type": "string"
              },
              "defaultDatasetId": {
                "type": "string"
              },
              "defaultRequestQueueId": {
                "type": "string"
              },
              "buildNumber": {
                "type": "string",
                "example": "1.0.0"
              },
              "containerUrl": {
                "type": "string"
              },
              "usage": {
                "type": "object",
                "properties": {
                  "ACTOR_COMPUTE_UNITS": {
                    "type": "integer",
                    "example": 0
                  },
                  "DATASET_READS": {
                    "type": "integer",
                    "example": 0
                  },
                  "DATASET_WRITES": {
                    "type": "integer",
                    "example": 0
                  },
                  "KEY_VALUE_STORE_READS": {
                    "type": "integer",
                    "example": 0
                  },
                  "KEY_VALUE_STORE_WRITES": {
                    "type": "integer",
                    "example": 1
                  },
                  "KEY_VALUE_STORE_LISTS": {
                    "type": "integer",
                    "example": 0
                  },
                  "REQUEST_QUEUE_READS": {
                    "type": "integer",
                    "example": 0
                  },
                  "REQUEST_QUEUE_WRITES": {
                    "type": "integer",
                    "example": 0
                  },
                  "DATA_TRANSFER_INTERNAL_GBYTES": {
                    "type": "integer",
                    "example": 0
                  },
                  "DATA_TRANSFER_EXTERNAL_GBYTES": {
                    "type": "integer",
                    "example": 0
                  },
                  "PROXY_RESIDENTIAL_TRANSFER_GBYTES": {
                    "type": "integer",
                    "example": 0
                  },
                  "PROXY_SERPS": {
                    "type": "integer",
                    "example": 0
                  }
                }
              },
              "usageTotalUsd": {
                "type": "number",
                "example": 0.00005
              },
              "usageUsd": {
                "type": "object",
                "properties": {
                  "ACTOR_COMPUTE_UNITS": {
                    "type": "integer",
                    "example": 0
                  },
                  "DATASET_READS": {
                    "type": "integer",
                    "example": 0
                  },
                  "DATASET_WRITES": {
                    "type": "integer",
                    "example": 0
                  },
                  "KEY_VALUE_STORE_READS": {
                    "type": "integer",
                    "example": 0
                  },
                  "KEY_VALUE_STORE_WRITES": {
                    "type": "number",
                    "example": 0.00005
                  },
                  "KEY_VALUE_STORE_LISTS": {
                    "type": "integer",
                    "example": 0
                  },
                  "REQUEST_QUEUE_READS": {
                    "type": "integer",
                    "example": 0
                  },
                  "REQUEST_QUEUE_WRITES": {
                    "type": "integer",
                    "example": 0
                  },
                  "DATA_TRANSFER_INTERNAL_GBYTES": {
                    "type": "integer",
                    "example": 0
                  },
                  "DATA_TRANSFER_EXTERNAL_GBYTES": {
                    "type": "integer",
                    "example": 0
                  },
                  "PROXY_RESIDENTIAL_TRANSFER_GBYTES": {
                    "type": "integer",
                    "example": 0
                  },
                  "PROXY_SERPS": {
                    "type": "integer",
                    "example": 0
                  }
                }
              }
            }
          }
        }
      }
    }
  }
}

📍 What is Google Maps Scraper?
Google Maps Scraper lets you extract business data from Google Maps, helping you generate leads, analyze competitors, and fuel growth with just a few clicks.

Generate qualified leads: extract business names, websites, emails, and phone numbers to build prospect lists for your sales team
Track competitors across regions: monitor where competitors operate, how they’re rated, and how many reviews they’ve received
Perform market analysis: analyze market saturation, identify service gaps, or benchmark local businesses by size, rating, and visibility
Support partnerships: discover top-rated or high-volume locations for outreach and collaboration
Automate research workflows: replace manual search tasks with repeatable, workflows that keep datasets fresh and consistent.
The scraper expands Google Maps data extraction beyond the limitations of the official Google Places API and bypasses the limitation of Google Maps of displaying (and scraping) no more than 120 places per area.

What data does Google Maps Scraper extract?
🔗 Title/place name	📝 Subtitle, category, place ID, and URL
📍 Address	🌍 Location, plus code and exact coordinates
☎️ Phone number	🌐 Website, if available
📝 Company contact details from website (company email, phone number and social media profiles)	🎯 Business leads enrichment (full name, work email address, phone number, job title, LinkedIn profile)
🌐 Search results	📊 Review count and review distribution
⭐️ Average rating (totalScore)	📸 List of images
➕ List of detailed characteristics (additionalInfo)	🔒 Temporarily or permanently closed status
🙋 Updates from customers & Questions and answers	🔍 People also search
🏷 Menu	💲 Price bracket
🧑‍🍳 Opening hours	⌚️ Popular times - histogram & live occupancy
🪑 Table reservation provider	🏨 Hotel booking URL and price + nearby hotels
⛽️ Gas prices	🛍 Multiple businesses located within indoor venues, such as malls or shopping centers.
For maximum usefulness, Google Maps Scraper has the following abilities:

Extract anything: names, addresses, websites, phone numbers, ratings, review counts, categories, or opening hours
Flexible search: scrape using any number of criteria, including search query, category, location, coordinates, or URL
Define the area to scrape: focus on specific locations, or set a wide area using coordinates or geolocation parameters
Flexible output format: export data into almost any format, with multiple views available
Integrate with other tools: use webhooks or our MCP server to set up workflows with other Actors or third-party tools like Make or Zapier
Use add-ons for further enrichment: use paid add-ons to further enrich your data with contact details, add images, or reviews
⬇️ Input
The input for Google Maps Scraper should be either a Google Maps URL or a location in combination with a search term. You can also extract any details such as images, reviews, amenities, and so on. You can set up the input programmatically or use the fields in scraper’s interface.

Search terms
Using multiple similar search terms can increase the number of scraped places but it also increases the time a run takes. We recommend using a combination of search terms that are distinct or overlap only slightly in meaning. Using a long list of duplicate search terms will just increase the time of a run without providing more results.

Example of a good list of search terms: [restaurant, bar, pub, cafe, buffet, ice cream, tea house]

Example of a bad list of search terms: [restaurant, restaurants, chinese restaurant, cafe, coffee, coffee shop, takeout]

While Google search results often include categories adjacent to your search, e.g. restaurant might also capture some cafe or bar places, but you will get better results if you use them as separate search terms, as well.

Categories
Using categories can be dangerous!

Search terms can introduce false positives, extracting some irrelevant places. Categories can be used to narrow down the results to just the ones you select.

Categories can also be dangerous because they can cause false negatives, excluding places you might want in the results. Google has thousands of categories and many are synonymous. You must list all the categories you want to match, including all synonyms; for example, Divorce lawyer, Divorce service, and Divorce attorney are three distinct categories and some places might be classified as only one of them, meaning you should input all of them. For this reason, we recommend going through the categories list carefully. For some use cases, you might want to select as many as 100 categories to ensure you don't miss any relevant places.

To help with this, Google Maps Scraper tries to increase the chance of a match by doing the following:

If any category of a place (each can have several categories) matches any category from your input, it will be included.
If all words from your input are contained in a category name, it will be included. E.g. restaurant will match Chinese restaurant and Pan Asian restaurant.
⚠️ If categories are used without search terms, they will be used both as search terms and as category filters. However, for the above reasons, using categories without search terms is not recommended. We generally recommend fewer search terms and many categories.

Search without geolocation
Rather than using the standard search term and location inputs, you may also opt to use only the search term (e.g. "restaurants in berlin") or a direct Google Maps search URL (e.g. https://www.google.com/maps/search/restaurants/@52.5190603,13.388574,13z/) without the location input field. However, this approach will limit the number of results to a maximum of 120 because it only opens a single map screen on Google with a finite scroll. We only recommend skipping location input if you don't need more than 120 results, you need the lowest possible latency, or you want to get the results in the same order as Google would provide.

Direct Place IDs or URLs
Alternatively, you can also upload a direct Google Maps Place ID or URL (or a list of them) to Google Maps Scraper, which will extract the place details directly without going through the search step first. Be aware that if you provide direct place IDs or URLs, you will be charged extra as this is part of a paid add-on, namely that for additional place details scraped.

⬆️ Output
The results will be wrapped into a dataset which you can find in the Output or Storage tab. Note that the output is organized in tables and tabs for viewing convenience. You can view results as a table, JSON, or as a map.

Once the run is finished, you can also download the dataset in various data formats (JSON, CSV, Excel, XML, HTML). Before exporting, you can pick or omit specific output fields; alternatively, you can also choose to download the whole view, which includes thematically connected data.

Reviews and Leads enrichment views spread each review or lead to a separate row for easier data processing.

Table view
The table view can be manipulated in different ways. There is a general overview, but you can also sort the table by contact info, location rating, reviews, or other fields.

image

JSON file
Here's the amount of data you'd get for a single scraped place (this one 📍 so you can compare). Example of 1 scraped restaurant in New York:

{
    "searchString": "Direct Detail URL: https://www.google.com/maps/place/Kim's+Island/@40.5107736,-74.2482624,17z/data=!4m6!3m5!1s0x89c3ca9c11f90c25:0x6cc8dba851799f09!8m2!3d40.5107736!4d-74.2482624!16s%2Fg%2F1tmgdcj8?hl=en&entry=ttu",
    "rank": null,
    "searchPageUrl": null,
    "searchPageLoadedUrl": null,
    "isAdvertisement": false,
    "title": "Kim's Island",
    "subTitle": null,
    "description": null,
    "price": "$10–20",
    "categoryName": "Chinese restaurant",
    "address": "175 Main St, Staten Island, NY 10307",
    "neighborhood": "Tottenville",
    "street": "175 Main St",
    "city": "Staten Island",
    "postalCode": "10307",
    "state": "New York",
    "countryCode": "US",
    "website": "http://kimsislandsi.com/",
    "phone": "(718) 356-5168",
    "phoneUnformatted": "+17183565168",
    "claimThisBusiness": false,
    "location": {
        "lat": 40.5107736,
        "lng": -74.2482624
    },
    "locatedIn": null,
    "plusCode": "GQ62+8M Staten Island, New York",
    "menu": "http://kimsislandsi.com/",
    "totalScore": 4.5,
    "permanentlyClosed": false,
    "temporarilyClosed": false,
    "placeId": "ChIJJQz5EZzKw4kRCZ95UajbyGw",
    "categories": ["Chinese restaurant", "Delivery Restaurant"],
    "fid": "0x89c3ca9c11f90c25:0x6cc8dba851799f09",
    "cid": "7838756667406262025",
    "reviewsCount": 91,
    "reviewsDistribution": {
        "oneStar": 4,
        "twoStar": 3,
        "threeStar": 3,
        "fourStar": 10,
        "fiveStar": 71
    },
    "imagesCount": 28,
    "imageCategories": ["All", "Menu", "Food & drink", "Vibe", "By owner", "Street View & 360°"],
    "scrapedAt": "2024-11-28T12:28:50.519Z",
    "reserveTableUrl": null,
    "googleFoodUrl": null,
    "hotelStars": null,
    "hotelDescription": null,
    "checkInDate": null,
    "checkOutDate": null,
    "similarHotelsNearby": null,
    "hotelReviewSummary": null,
    "hotelAds": [],
    "openingHours": [
        {
            "day": "Monday",
            "hours": "Closed"
        },
        {
            "day": "Tuesday",
            "hours": "11 AM to 9:30 PM"
        },
        {
            "day": "Wednesday",
            "hours": "11 AM to 9:30 PM"
        },
        {
            "day": "Thursday",
            "hours": "11 AM to 12 AM"
        },
        {
            "day": "Friday",
            "hours": "12 to 9:30 AM, 11 AM to 10:30 PM"
        },
        {
            "day": "Saturday",
            "hours": "11 AM to 10:30 PM"
        },
        {
            "day": "Sunday",
            "hours": "12 to 9:30 PM"
        }
    ],
    "peopleAlsoSearch": [
        {
            "category": "People also search for",
            "title": "Island Kitchen Chinese",
            "reviewsCount": 70,
            "totalScore": 3.4
        },
        {
            "category": "People also search for",
            "title": "New Island",
            "reviewsCount": 116,
            "totalScore": 3.9
        },
        {
            "category": "People also search for",
            "title": "Islander Taste Chinese Restaurant",
            "reviewsCount": 119,
            "totalScore": 4.2
        },
        {
            "category": "People also search for",
            "title": "Kum Fung",
            "reviewsCount": 168,
            "totalScore": 3.8
        }
    ],
    "placesTags": [],
    "reviewsTags": [
        {
            "title": "prices",
            "count": 6
        },
        {
            "title": "delivery",
            "count": 4
        },
        {
            "title": "spareribs",
            "count": 3
        },
        {
            "title": "dumpling",
            "count": 2
        },
        {
            "title": "lo mein",
            "count": 2
        }
    ],
    "additionalInfo": {
        "Service options": [
            {
                "Takeout": true
            },
            {
                "Dine-in": true
            }
        ],
        "Popular for": [
            {
                "Lunch": true
            },
            {
                "Dinner": true
            },
            {
                "Solo dining": true
            }
        ],
        "Accessibility": [
            {
                "Wheelchair accessible entrance": true
            },
            {
                "Wheelchair accessible seating": true
            },
            {
                "Assistive hearing loop": false
            },
            {
                "Wheelchair accessible parking lot": false
            },
            {
                "Wheelchair accessible restroom": false
            }
        ],
        "Offerings": [
            {
                "Comfort food": true
            },
            {
                "Healthy options": true
            },
            {
                "Quick bite": true
            },
            {
                "Small plates": true
            }
        ],
        "Dining options": [
            {
                "Lunch": true
            },
            {
                "Dinner": true
            }
        ],
        "Amenities": [
            {
                "Restroom": false
            }
        ],
        "Atmosphere": [
            {
                "Casual": true
            }
        ],
        "Planning": [
            {
                "Accepts reservations": false
            }
        ],
        "Payments": [
            {
                "Credit cards": true
            },
            {
                "Debit cards": true
            },
            {
                "NFC mobile payments": true
            },
            {
                "Credit cards": true
            }
        ],
        "Children": [
            {
                "Good for kids": true
            }
        ]
    },
    "gasPrices": [],
    "questionsAndAnswers": [],
    "updatesFromCustomers": null,
    "ownerUpdates": [],
    "url": "https://www.google.com/maps/search/?api=1&query=Kim's%20Island&query_place_id=ChIJJQz5EZzKw4kRCZ95UajbyGw",
    "imageUrl": "https://lh5.googleusercontent.com/p/AF1QipMyThXuZMjeiMZfTM42rbJJGm-q54JNzL3xsCn_=w408-h306-k-no",
    "kgmid": "/g/1tmgdcj8",
    "webResults": [],
    "parentPlaceUrl": null,
    "tableReservationLinks": [],
    "bookingLinks": [],
    "orderBy": [
        {
            "name": "kimsislandsi.com",
            "orderUrl": "http://kimsislandsi.com/"
        }
    ],
    "images": [
        {
            "imageUrl": "https://lh5.googleusercontent.com/p/AF1QipMyThXuZMjeiMZfTM42rbJJGm-q54JNzL3xsCn_=w1920-h1080-k-no",
            "authorName": "Sebastian Sinisterra (CitySeby)",
            "authorUrl": "https://maps.google.com/maps/contrib/103237729589375373179",
            "uploadedAt": "2017-05-30T00:00:00.000Z"
        }
    ],
    "imageUrls": ["https://lh5.googleusercontent.com/p/AF1QipMyThXuZMjeiMZfTM42rbJJGm-q54JNzL3xsCn_=w1920-h1080-k-no"],
    "reviews": [
        {
            "name": "Rocco Castellano",
            "text": "Excellent  food great service n always  on time",
            "textTranslated": null,
            "publishAt": "a month ago",
            "publishedAtDate": "2024-10-11T01:23:42.544Z",
            "likesCount": 0,
            "reviewId": "ChdDSUhNMG9nS0VJQ0FnSURuNV9DVnFRRRAB",
            "reviewUrl": "https://www.google.com/maps/reviews/data=!4m8!14m7!1m6!2m5!1sChdDSUhNMG9nS0VJQ0FnSURuNV9DVnFRRRAB!2m1!1s0x0:0x6cc8dba851799f09!3m1!1s2@1:CIHM0ogKEICAgIDn5_CVqQE%7CCgwInvyhuAYQyOjhgwI%7C?hl=en",
            "reviewerId": "108813127648936384314",
            "reviewerUrl": "https://www.google.com/maps/contrib/108813127648936384314?hl=en",
            "reviewerPhotoUrl": "https://lh3.googleusercontent.com/a-/ALV-UjXRb3lzFb-4SdRMWMlaaECCmdFwULv7bvKKVOK-3mmDcBWyJnY3XQ=s120-c-rp-mo-ba4-br100",
            "reviewerNumberOfReviews": 74,
            "isLocalGuide": true,
            "reviewOrigin": "Google",
            "stars": 5,
            "rating": null,
            "responseFromOwnerDate": null,
            "responseFromOwnerText": null,
            "reviewImageUrls": [],
            "reviewContext": {},
            "reviewDetailedRating": {
                "Food": 5,
                "Service": 5,
                "Atmosphere": 5
            }
        }
    ],
    "userPlaceNote": null,
    "restaurantData": {}
}

🏢 Company contacts enrichment

{
    "title": "Daniel's Jewelers",
    "instagrams": ["https://www.instagram.com/danielsjewelers/"],
    "facebooks": ["https://www.facebook.com/DanielsJewelers"],
    "linkedIns": [],
    "youtubes": ["https://www.youtube.com/channel/UCUgzkwhbbodMnOwDIPJj0_g"],
    "tiktoks": ["https://www.tiktok.com/@DanielsJewelers"],
    "twitters": ["https://twitter.com/danielsjewelers"],
    "pinterests": ["https://www.pinterest.com/daniel_jewelers/"]
}

👥 Business leads enrichment

{
    "city": "Seattle",
    "state": "Washington",
    "personId": "2746893668571939229",
    "firstName": "Benjamin",
    "lastName": "White",
    "fullName": "Benjamin White",
    "linkedinProfile": "https://www.linkedin.com/in/benjamin-white-2562a3212",
    "email": null,
    "mobileNumber": null,
    "headline": "Influencer a Content Creator (IG, TT)",
    "jobTitle": "Sales Manager",
    "department": ["Marketing"],
    "industry": "Food&Beverage",
    "seniority": ["entry"],
    "country": "United States",
    "photoUrl": "https://media.licdn.com/dms/image/v2/...",
    "companyId": "23734538243567720",
    "companyName": "Happy Eating",
    "companyWebsite": "happyeating.com",
    "companySize": "51 - 200",
    "companyLinkedin": "https://www.linkedin.com/company/62543",
    "twitter": null,
    "companyCity": null,
    "companyState": null,
    "companyCountry": null,
    "companyPhoneNumber": null
}

🏩 External places (hotels)

Google sometimes shows these places when searching in certain locations, mainly for hotels. They are however not regular places with pins on the map and offer only some of the regular output fields. These places are marked with 3 extra output fields:

{
    "url": "https://www.google.com/maps/place/Al Eairy Furnished Apartments Al Madinah 9/@24.4857006,39.6083984,14z/data=!3m1!4b1!4m9!3m8!5m2!4m1!1i2!8m2!3d24.4857006!4d39.6083984!16s%2Fg%2F11pkhzvq1s!17BQ0FF",
    "isExternalServicePlace": true,
    "externalServiceProvider": "SuperTravel",
    "externalId": "/g/11pkhzvq1s"
}

🏩 Hotel-specific info

{
    "hotelStars": "4-star hotel",
    "hotelDescription": "This old-world-style luxury hotel is in a historic property that dates from 1874; it's a 1-minute walk from the Long Island Railroad and 19 miles from Manhattan.\n The posh rooms have flat-screen TVs, Italian furniture, Wi-Fi (surcharge) and 24-hour room service. Upgraded suites add kitchenettes and living areas, while some feature an additional bathroom and private outdoor patios.\n Perks include 25,000 sq ft of event space, an indoor pool, a spa and sauna, a fitness center and an upscale steakhouse, plus a seasonal patio bar, and lounge. Pet walking and feeding services are available. Parking is free.",
    "checkInDate": "2025-06-14",
    "checkOutDate": "2025-06-16",
    "similarHotelsNearby": [
        {
            "name": "Residence Inn Long Island Garden City",
            "rating": 4.4,
            "reviews": 343,
            "description": "3-star hotel for $106 less",
            "price": "$314"
        }
    ],
    "hotelAds": [
        {
            "title": "The Garden City Hotel",
            "googleUrl": "https://www.google.com/travel/clk?pc=AA80OszXBIdUZO7GzR4oaDKGGYgwtzoN1hEaPsbn1HgF9Wwivx7OBUZu8wk92iyvRK9W_p-WkOMG1-u0Bdtj1BFI72vfNZb2dFixfuolOX52jMRCNZFBlJXhJqbsoAQk2wyQgoo&pcurl=https://linkcenter.derbysoftca.com/dplatform-linkcenter/booking.htm?hotelCode%3DTAMBOURINE-27213%26providerHotelCode%3DTAMBOURINE-27213%26checkInDate%3D2025-06-14%26checkOutDate%3D2025-06-16%26identifier%3Ddh-google%26price%3D1002.60%26roomTypeCode%3DDK%26ratePlanCode%3DMKTSSA%26currency%3DUSD%26userCurrency%3DUSD%26language%3Den%26userCountry%3DUS%26testClick%3Dfalse%26sitetype%3Dmapresults%26deviceType%3Ddesktop%26priceDisplayedTax%3D162.80%26priceDisplayedTotal%3D1002.60%26partnerId%3Dderbysoft%26campaignid%3D%26userlistid%3D%26ifDefaultDate%3Ddefault%26isPromoted%3Dfalse%26s_is_ad%3Dfalse%26adults%3D2%26children%3D0%26clk_src%3D%26is_ds_account%3Dtrue",
            "isOfficialSite": true,
            "price": "$501",
            "url": "https://linkcenter.derbysoftca.com/dplatform-linkcenter/booking.htm?hotelCode=TAMBOURINE-27213&providerHotelCode=TAMBOURINE-27213&checkInDate=2025-06-14&checkOutDate=2025-06-16&identifier=dh-google&price=1002.60&roomTypeCode=DK&ratePlanCode=MKTSSA&currency=USD&userCurrency=USD&language=en&userCountry=US&testClick=false&sitetype=mapresults&deviceType=desktop&priceDisplayedTax=162.80&priceDisplayedTotal=1002.60&partnerId=derbysoft&campaignid=&userlistid=&ifDefaultDate=default&isPromoted=false&s_is_ad=false&adults=2&children=0&clk_src=&is_ds_account=true"
        }
    ]
}

🍽️ Restaurant-specific info

{
    "price": "$$",
    "menu": "https://www.carminesnyc.com/menus/menus-clv-q420-dining",
    "reserveTableUrl": "https://www.google.com/maps/reserve/v/dine/c/c4Zm37ew3wU?source=pa&opi=79508299&hl=en-US&gei=TjAsaK7YGeuw5NoPi7Tl2Q0&sourceurl=https://www.google.com/service/MapsPlaceService/GetPlace?hl%3Den%26authuser%3D0%26gl%3Dus%26q%3DButter",
    "tableReservationLinks": [
        {
            "name": "carminesnyc.com",
            "url": "https://www.carminesnyc.com/locations/times-square"
        }
    ],
    "bookingLinks": [],
    "restaurantData": {
        "tableReservationProvider": {
            "name": "Resy",
            "reserveTableUrl": "https://www.google.com/maps/reserve/v/dine/c/c4Zm37ew3wU?source=pa&opi=79508299&hl=en-US&gei=TjAsaK7YGeuw5NoPi7Tl2Q0&sourceurl=https://www.google.com/service/MapsPlaceService/GetPlace?hl%3Den%26authuser%3D0%26gl%3Dus%26q%3DButter"
        }
    },
    "orderBy": [
        {
            "name": "Carmines + Virgils",
            "orderUrl": "https://carminesnyc.olo.com/menu/little-fish-corp?handoff=delivery&rwg_token=AAiGsoYBYxq5jyN-YutbSAJuGCp3xDXsO-Mcxwgv8VROx6oEcP42nRabvXDDNR2sgmzLAnEHoHPUIHLp618-f2VE312hhV41gw%3D%3D"
        }
    ]
}

Map view
Google Maps Scraper provides a zoomable map that shows all the places scraped. The map is shown in the Live View tab on the actor run page and also stored in the Key-Value Store as results-map.html record.



📍📡 Using geolocation for pinpoint accuracy
Location, country, state, county, city, and postal code
Using free text in Location field should normally be enough to start scraping. For a more precise search, you can also use the Geolocation parameters field and use a combination of country, state, county, city, and postalCode.

Google Maps Scraper uses Open Street Map as its geolocation API. You can easily check the location matching your geolocation input on the official Open Street Map page.

🛰 Custom search area
If your location can’t be found on Google Maps or you want to customize it for a specific area, you can use the Custom search area function. You’ll have to provide coordinate pairs for an area and the scraper will create start URLs out of them. As an example, see the geojson field in Nominatim Api (example of Cambridge in Great Britain).

There are several types of search area geometry that you can use in Google Maps Scraper: Polygon, MultiPolygon and Point (a circle with a radius of 5 kilometers by default). All of them follow the official Geo Json RFC and all types are supported. We’ve found the polygons and circle to be the most useful ones when it comes to scraping.

Note that the order of longitude and latitude is reversed in GeoJson 🔄 compared to the Google Maps website. The first field must be longitude ↕️, the second field must be latitude ↔️.

We recommend using Geojson.io to create customGeolocation of any type/shape in correct format. You can watch this video on how to use it together with our scraper.

💠 Polygon

The most common type is a polygon, which is a set of points that define the scraped area. Note that the first and last pair of coordinates must be identical (to close the polygon). This example covers most of the city of London, UK:

{
    "type": "Polygon",
    "coordinates": [
        [
            [
                // Must be the same as last one
                -0.322813, // Longitude
                51.597165 // Latitude
            ],
            [-0.31499, 51.388023],
            [0.060493, 51.389199],
            [0.051936, 51.60036],
            [
                // Must be the same as the first one
                -0.322813, 51.597165
            ]
            // ...
        ]
    ]
}

💠💠 MultiPolygon

MultiPolygon can combine more polygons that are not contiguous (for example, an island close to the mainland). Same as with the polygon, make sure the first and the last pair of coordinates in each polygon are identical.

{
    "type": "MultiPolygon",
    "coordinates": [
        [
            // first polygon
            [
                [
                    12.0905752, // Longitude
                    50.2524063 // Latitude
                ],
                [12.1269337, 50.2324336]
                // ...
            ]
        ],
        [
            // second polygon
            // ...
        ]
    ]
}

🔘 Circle

For a circle, we can use the Point type with our custom parameter radiusKm. Don't forget to change the radius to fit your needs. This example covers the city of Basel in Switzerland:

{
    "type": "Point",
    "coordinates": ["7.5503", "47.5590"],
    "radiusKm": 8
}

❓FAQ
How does Google Maps Scraper work?
It works exactly as if you were searching through Google Maps and copying information from each page you find. It opens the Google Maps website, goes to a specified location, then writes your search query into the search bar. Then it scrolls down until it reaches the end of the scroll bar or maxCrawledPlacesPerSearch. It enqueues all the places as separate pages and then copypastes all visible data into an organized document. This process is repeated for many map pages inside the input location. To understand the process fully, just try it out in your browser - the scraper does exactly the same thing, only much faster.

What are the disadvantages of the Google Maps API?
With the Google Maps API, you get $200 worth of credit usage every month free of charge. That means 28,500 map loads per month. However, the Google Maps API caps your search results to 60, regardless of the radius you specify. So, if you want to scrape data for bars in New York, for example, you'll get results for only 60 of the thousands of bars in the area. Google Maps Scraper imposes no rate limits or quotas and provides more cost-effective, comprehensive results, and also scrapes histograms for popular times, which aren't available in the official API.

Can I scrape places from multiple locations?
While Google Maps Scraper supports only single location query, you can use Google Maps Scraper Orchestrator to scrape multiple locations with a single list. It will automatically run the Google Maps Scraper for each location in the list and merge the results. It also fully uses your Apify account memory for maximum speed. If you want to use only Google Maps Scraper, you can add multiple locations using customGeolocation with multiple polygons.

How can I increase the speed of the scraper?
You can increase the run memory up to 8 GB per run. To speed up the scraping even more, you can run several runs at once to fully utilize all your account memory. To make this simpler, you can use the Google Maps Scraper Orchestrator to split locations or search terms over multiple runs, deduplicate the results and collect them to a single dataset.

Can I use the Google Maps Scraper to extract Google reviews?
Yes. This Google Maps Scraper also supports the extraction of detailed information about reviews on Google Maps. Note that personal data extraction about reviewers is also possible but has to be explicitly enabled in input (see the Legality of scraping Google Maps section).

📝 Review text	📅 Published date
🌟 Stars	🆔 Review ID & URL
✅ Response from the owner - text	📷 List of review images
💬 Review context	📊 Detailed rating per service
🧛 Reviewer’s name	✍️ Reviewer’s number of reviews
🖼 Reviewer’s ID, URL & photo	👋 IsLocalGuide
How can I get one review per row in the output?
If you need to view reviews in a table with each review in a separate row, you can click on the Reviews (if any) Export dataset view.

To use this view via API, you need to add &view=reviews to the dataset export URL. E.g. https://api.apify.com/v2/datasets/DATASET_ID/items?clean=true&format=json&view=reviews

If you don't use the Reviews (if any) view, each output place item will contain a maximum of 5,000 reviews (in table format, it means a lot of columns). So if there are more reviews for that place, a duplicate place will be stored with the next 5,000 reviews, and so on. For instance, in a case of 50,000 reviews, the resulting dataset will have 10 items for the same place. We have this limitation due to the size limit of a single item in the Apify dataset.

Can I integrate Google Maps Scraper with other apps?
Yes. The Google Maps Scraper can be connected with almost any cloud service or web app thanks to integrations on the Apify platform. You can integrate your Google Maps data with Zapier, Slack, Make, Airbyte, GitHub, Google Sheets, Asana, LangChain and more.

You can also use webhooks to carry out an action whenever an event occurs, for example, get a notification whenever Google Maps Scraper successfully finishes a run.

Can I use Google Maps Scraper as its own API?
Yes, you can use the Apify API to access Google Maps Scraper programmatically. The API allows you to manage, schedule, and run Apify actors, access datasets, monitor performance, get results, create and update actor versions, and more.

To access the API using Node.js, you can use the apify-client NPM package. To access the API using Python, you can use the apify-client PyPI package.

For detailed information and code examples, see the API tab or refer to the Apify API documentation.

Can I use this Google Maps Scraper API in Python?
Yes, you can use the Apify API with Python. To access the Google Maps Scraper API with Python, use the apify-client PyPI package. You can find more details about the client in our Python Client documentation.

What are other tools I can use with Google Maps?
Use the dedicated scrapers below and combine them with Google Maps Scraper for more comprehensive analysis.

🪢 Google Maps Scraper Orchestrator	⭐️ AI Text Analyzer for Google Reviews
🤖 Competitive Intelligence Agent	🤖 Market Expansion Agent
Is it legal to scrape Google Maps data?
Web scraping is legal if you are extracting publicly available data which is most data on Google Maps. However, you should respect boundaries such as personal data and intellectual property regulations. You should only scrape personal data if you have a legitimate reason to do so, and you should also factor in Google's Terms of Use.

Your feedback
We’re always working on improving the performance of our Actors. So if you’ve got any technical feedback for Google Maps Scraper or simply found a bug, please create an issue on the Actor’s Issues tab.

🔍 Search term(s)
OptionalarraysearchStringsArray

Description:
Type what you’d normally search for in the Google Maps search bar, like English breakfast or pet shelter. Aim for unique terms for faster processing. Using similar terms (e.g., bar vs. restaurant vs. cafe) may slightly increase your capture rate but is less efficient.

⚠️ Heads up: Adding a location directly to the search, e.g., restaurant Pittsburgh, can limit you to a maximum of 120 results per search term due to Google Maps' scrolling limit.

You can also use direct place IDs here in the format place_id:ChIJ8_JBApXMDUcRDzXcYUPTGUY.See the detailed description.

📍 Location (use only one location per run)
OptionalstringlocationQuery

Description:
Define location using free text. Simpler formats work best; e.g., use City + Country rather than City + Country + State. Verify with the OpenStreetMap webapp for visual validation of the exact area you want to cover.

⚠️ Automatically defined City polygons may be smaller than expected (e.g., they don't include agglomeration areas). If you need to define the whole city area, head over to the 📡 Geolocation parameters* section instead to select Country, State, County, City, or Postal code.
For an even more precise location definition (especially when using City name as a starting point), head over to 🛰 Custom search area section to create polygon shapes of the areas you want to scrape. Note that 📍 Location settings always take priority over 📡 Geolocation* (so use either section but not both at the same time).

For guidance and tricks on location definition, check our tutorial.

💯 Number of places to extract (per each search term or URL)
OptionalintegermaxCrawledPlacesPerSearch

Description:
Number of results you expect to get per each Search term, Category or URL. The higher the number, the longer it will take.

If you want to scrape all the places available, leave this field empty or use this section 🧭 Scrape all places on the map*.

Minimum: 1

🌍 Language
Optionalstringlanguage

Description:
Results details will show in this language.

Options:
en
af
az
id
ms
bs
ca
cs
da
de
et
es
es-419
eu
fil
fr
gl
hr
zu
is
it
sw
lv
lt
hu
nl
no
uz
pl
pt-BR
pt-PT
ro
sq
sk
sl
fi
sv
vi
tr
el
bg
ky
kk
mk
mn
ru
sr
uk
ka
hy
iw
ur
ar
fa
am
ne
hi
mr
bn
pa
gu
ta
te
kn
ml
si
th
lo
my
km
ko
ja
zh-CN
zh-TW
Default value of this property is: "en"

🎢 Place categories ($)
OptionalarraycategoryFilterWords

Description:
You can limit the places that are scraped based on the Category filter; you can choose as many categories for one flat fee for the whole field. ⚠️ Using categories can sometimes lead to false negatives, as many places do not properly categorize themselves, and there are over 4,000 available categories which Google Maps has. Using categories might filter out places that you’d like to scrape. To avoid this problem, you must list all categories that you want to scrape, including synonyms, e.g., divorce lawyer, divorce attorney, divorce service, etc. See the detailed description.

Get exact name matches (no similar results)($)
OptionalstringsearchMatching

Description:
Restrict what places are scraped based on matching their name with provided 🔍 Search term. E.g., all places that have chicken in their name vs. places called Kentucky Fried Chicken.

Options:
all
only_includes
only_exact
Default value of this property is: "all"

Set a minimum star rating ($)
OptionalstringplaceMinimumStars

Description:
Scrape only places with a rating equal to or above the selected stars. Places without reviews will also be skipped. Keep in mind, filtering by reviews reduces the number of places found per credit spent, as many will be excluded.

Options:
two
twoAndHalf
three
threeAndHalf
four
fourAndHalf
Default value of this property is: ""

Scrape places with/without a website($)
Optionalstringwebsite

Description:
Use this to exclude places without a website, or vice versa. This option is turned off by default.

Options:
allPlaces
withWebsite
withoutWebsite
Default value of this property is: "allPlaces"

⏩ Skip closed places ($)
OptionalbooleanskipClosedPlaces

Description:
Skip places that are marked as temporary or permanently closed. Ideal for focusing on currently open places.

Default value of this property is: false

Scrape place detail page ($)
OptionalbooleanscrapePlaceDetailPage

Description:
Scrape detail pages of each place the Actor finds. This will slow down the Actor since it needs to open another page for each place individually.

The fields available only when scrapePlaceDetailPage is enabled include: reviewsDistribution, imageCategories, popularTimes fields, openingHours, BusinessConfirmationText, peopleAlsoSearch, reviewsTags, updatesFromCustomers, questionsAndAnswers, tableReservationLinks, orderBy, ownerUpdates, and hotel fields.

This option needs to be enabled if you wish to use any of the options below.

Default value of this property is: false

Scrape table reservation provider data ($)
OptionalbooleanscrapeTableReservationProvider

Description:
Scrape table reservation provider data like name, address, email or phone. This data is present only in restaurants that have blue "RESERVE A TABLE" button

Default value of this property is: false

🌐 Include "Web results" ($)
OptionalbooleanincludeWebResults

Description:
Extract the "Web results" section located at the bottom of every place listing.

Default value of this property is: false

🛍 Scrape inside places (e.g. malls or shopping center) ($)
OptionalbooleanscrapeDirectories

Description:
Some places (e.g. malls) can have multiple businesses located inside them. This option will scrape inside the "Directory" or "At this place" as per different categories (example here). Turn this toggle on to include those places in your results.

⚠️ Note that that full place details needs to be scraped in order to scrape directories.

Default value of this property is: false

Number of questions to extract ($)
OptionalintegermaxQuestions

Description:
Set the number of questions per place you expect to scrape. If you fill in 0 or leave the field empty, only the first question and answer will be scraped. To extract all questions, type 999 into the field.

⚠️ Note that some of the fields contain personal data.

Minimum: 0

Default value of this property is: 0

⏩ Add-on: Company contacts enrichment (from website)
OptionalbooleanscrapeContacts

Description:
Enrich Google Maps places with contact details extracted from the business website, including business emails and social media profiles (Meta, LinkedIn, X, etc). Price is charged per place at $2 per 1000 places that have a website.

We exclude contacts of big chains: mcdonalds, starbucks, dominos, pizzahut, burgerking, kfc, subway, wendys, dunkindonuts, tacobell.

Default value of this property is: false

⏩ Add-on: Extract business leads information - Maximum leads per place
OptionalintegermaximumLeadsEnrichmentRecords

Description:
Enrich your results with detailed contact and company information, including employee names, job titles, emails, phone numbers, LinkedIn profiles, and key company data like industry and number of employees.

This setting allows you to set the maximum number of leads records you want to scrape per each place found on the map (that has a website). By default, it's set to 0 which means that no leads information will be scraped.

⚠️ Note that some of the fields contain personal data. GDPR protects personal data in the European Union and by other regulations around the world. You should not scrape personal data unless you have a legitimate reason to do so. If you're unsure whether your use case is legitimate, please consult an attorney.

We exclude leads of big chains as these are not related to the local places: mcdonalds, starbucks, dominos, pizzahut, burgerking, kfc, subway, wendys, dunkindonuts, tacobell.

Default value of this property is: 0

Leads departments selection
OptionalarrayleadsEnrichmentDepartments

Description:
You can use this filter to include only specific departments (like Sales, Marketing, or C-Suite). Note: This will only work if the ⏩ Add-on: Extract business leads information - Maximum leads per place (maximumLeadsEnrichmentRecords) option is enabled. Please note that some job titles are sometimes miscategorized in the wrong departments.

Number of reviews to extract ($)
OptionalintegermaxReviews

Description:
Set the number of reviews you expect to get per place, priced at 0.5 per thousand reviews, plus an additional charge of $0.002 per place when scraping reviews, since the Scraper triggers the Extra place details scraped event for each place. To extract all reviews, leave this field empty.

Each output place item can contain maximum 5,000 reviews so in case more reviews are extracted, a duplicate place is stored with the next 5,000 reviews and so on.
⚠️ Enabling this feature might slow the search down.

Minimum: 0

Default value of this property is: 0

Extract only reviews posted after [date]
OptionalstringreviewsStartDate

Description:
Either absolute date (e.g. 2024-05-03) or relative date from now into the past (e.g. 8 days, 3 months). JSON input also supports adding time in both absolute (ISO standard, e.g. 2024-05-03T20:00:00) and relative (e.g. 3 hours) formats. Absolute time is always interpreted in the UTC timezone, not your local timezone - please convert accordingly. Supported relative date & time units: minutes, hours, days, weeks, months, years.

⚠️ Heads up: If this parameter is specified, you must choose the 'Newest' sort by value. The reason for this is that with this parameter entered, the actor stops scraping reviews as soon as it finds the first review that's older than the specified date. If the sorting is not set to 'Newest', it might encounter a review older than the specified date before it reaches the desired review count and not scrape the desired amount of reviews.

Sort reviews by
OptionalstringreviewsSort

Description:
Define the order in which reviews should be sorted.

Options:
newest
mostRelevant
highestRanking
lowestRanking
Default value of this property is: "newest"

Filter reviews by keywords
OptionalstringreviewsFilterString

Description:
If you enter keywords, only reviews containing those keywords will be scraped. Leave it blank to scrape all reviews.

Default value of this property is: ""

Reviews origin
OptionalstringreviewsOrigin

Description:
Select whether you want all reviews (from Google, Tripadvisor, etc.) or only reviews from Google

Options:
all
google
Default value of this property is: "all"

🧛‍♂️ Include reviewers' data
OptionalbooleanscrapeReviewsPersonalData

Description:
This setting allows you to get personal data about the reviewer (their ID, name, URL, and photo URL) and about review (ID and URL).

⚠️ Personal data is protected by the GDPR in the European Union and by other regulations around the world. You should not scrape personal data unless you have a legitimate reason to do so. If you're unsure whether your reason is legitimate, consult your lawyers.

Default value of this property is: true

Number of additional images to extract ($)
OptionalintegermaxImages

Description:
Set the number of images per place you expect to scrape. Please note that there is an additional charge of $0.002 per place when scraping images, since the Scraper triggers the Extra place details scraped event for each place. To extract all images, leave this field empty. The higher the number, the slower the search.

Minimum: 0

🧑‍🎨 Include the image authors
OptionalbooleanscrapeImageAuthors

Description:
Include the author name for each image.

⚠️ Enabling this toggle may slow down processing as it requires fetching information for each image individually.

Default value of this property is: false

🗺 Country
OptionalstringcountryCode

Description:
Set the country where the data extraction should be carried out, e.g., United States.

Options:
us
af
al
dz
as
ad
ao
ai
aq
ag
ar
am
aw
au
at
az
bs
bh
bd
bb
by
be
bz
bj
bm
bt
bo
ba
bw
bv
br
io
bn
bg
bf
bi
kh
cm
ca
cv
ky
cf
td
cl
cn
cx
cc
co
km
cg
cd
ck
cr
ci
hr
cu
cy
cz
dk
dj
dm
do
ec
eg
sv
gq
er
ee
et
fk
fo
fj
fi
fr
gf
pf
tf
ga
gm
ge
de
gh
gi
gr
gl
gd
gp
gu
gt
gn
gw
gy
ht
hm
va
hn
hk
hu
is
in
id
ir
iq
ie
il
it
jm
jp
jo
kz
ke
ki
kp
kr
kw
kg
la
lv
lb
ls
lr
ly
li
lt
lu
mo
mk
mg
mw
my
mv
ml
mt
mh
mq
mr
mu
yt
mx
fm
md
mc
mn
me
ms
ma
mz
mm
na
nr
np
nl
an
nc
nz
ni
ne
ng
nu
nf
mp
no
om
pk
pw
ps
pa
pg
py
pe
ph
pn
pl
pt
pr
qa
re
ro
ru
rw
sh
kn
lc
pm
vc
ws
sm
st
sa
sn
rs
sc
sl
sg
sk
si
sb
so
za
gs
ss
es
lk
sd
sr
sj
sz
se
ch
sy
tw
tj
tz
th
tl
tg
tk
to
tt
tn
tr
tm
tc
tv
ug
ua
ae
gb
um
uy
uz
vu
ve
vn
vg
vi
wf
eh
ye
zm
zw
🌇 City
Optionalstringcity

Description:
Enter the city where the data extraction should be carried out, e.g., Pittsburgh.

⚠️ Do not include State or Country names here.

⚠️ Automatic City polygons may be smaller than expected (e.g., they don't include agglomeration areas). If you need that, set up the location using Country, State, County, City, or Postal code.
For an even more precise location definition (, head over to 🛰 Custom search area section to create polygon shapes of the areas you want to scrape.

State
Optionalstringstate

Description:
Set a state where the data extraction should be carried out, e.g., Massachusetts (mainly for the US addresses).

County
Optionalstringcounty

Description:
Set the county where the data extraction should be carried out.

⚠️ Note that county may represent different administrative areas in different countries: a county (e.g., US), regional district (e.g., Canada) or département (e.g., France).

Postal code
OptionalstringpostalCode

Description:
Set the postal code of the area where the data extraction should be carried out, e.g., 10001.

⚠️ Combine Postal code only with 🗺 Country, never with 🌇 City. You can only input one postal code at a time.

🛰 Custom search area (coordinate order must be: [↕ longitude, ↔ latitude])
OptionalobjectcustomGeolocation

Description:
Use this field to define the exact search area if other search area parameters don't work for you. See readme or our guide for details.

Google Maps URLs
OptionalarraystartUrls

Description:
Max 300 results per search URL. Valid format for URLs contains google.com/maps/. This feature also supports uncommon URL formats such as: google.com?cid=***, goo.gl/maps, and custom place list URL.

🗃 Place IDs
OptionalarrayplaceIds

Description:
List of place IDs. You can add place IDs one by one or upload a list using the Bulk edit option. Place ID has format ChIJreV9aqYWdkgROM_boL6YbwA

Scrape all places
OptionalstringallPlacesNoSearchAction

Description:
Extract all places visible on the map. Use the Override zoom level parameter to select the level of detail. Higher zoom will scrape more places but will take longer to finish. You can test what place pins are visible with a specific zoom by changing the 16z part of the Google Maps URL.

Options:
all_places_no_search_ocr
all_places_no_search_mouse
Default value of this property is: ""

Example 
{
    "searchStringsArray": [
        "restaurant"
    ],
    "locationQuery": "New York, USA",
    "maxCrawledPlacesPerSearch": 50,
    "language": "en",
    "searchMatching": "all",
    "placeMinimumStars": "",
    "website": "allPlaces",
    "skipClosedPlaces": false,
    "scrapePlaceDetailPage": false,
    "scrapeTableReservationProvider": false,
    "includeWebResults": false,
    "scrapeDirectories": false,
    "maxQuestions": 0,
    "scrapeContacts": false,
    "maximumLeadsEnrichmentRecords": 0,
    "maxReviews": 0,
    "reviewsSort": "newest",
    "reviewsFilterString": "",
    "reviewsOrigin": "all",
    "scrapeReviewsPersonalData": true,
    "scrapeImageAuthors": false,
    "allPlacesNoSearchAction": ""
}