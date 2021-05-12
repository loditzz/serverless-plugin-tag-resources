const BbPromise = require("bluebird");

class ServerlessPlugin {
  constructor(serverless, options) {
    this.serverless = serverless;
    this.options = options || {};
    this.provider = serverless ? serverless.getProvider("aws") : null;
    this.service = serverless.service;
    this.stage = null;
    this.region = null;
    this.awsService = this.serverless.getProvider("aws");

    if (!this.provider) {
      throw new Error("This plugin must be used with AWS");
    }

    this.commands = {
      "tags:update": {
        usage: "Update all the crawlers functions",
        lifecycleEvents: ["start"],
      },
    };

    this.hooks = {
      "before:tags:update:start": () => BbPromise.bind(this).then(this.addTagsToResources(true)),
      "after:deploy:deploy": () => BbPromise.bind(this).then(this.addTagsToResources),
    };
  }

  async addTagsToResources(isLocal = false) {
    for (const [key, value] of Object.entries(this.serverless.service.provider.environment)) {
      process.env[key] = value;
    }

    const { region, profile } = this.serverless.service.provider;
    const Key = this.serverless.service.custom.customTagKey;
    this.serverless.cli.log(`STARTED TAGS UPDATE`);

    if (isLocal) {
      const credentials = new this.awsService.sdk.SharedIniFileCredentials({ profile });
      this.awsService.sdk.config.credentials = credentials;
      this.awsService.sdk.config.region = region;
    }

    const SQS = new this.awsService.sdk.SQS({ region });
    const lambda = new this.awsService.sdk.Lambda({ region });
    const dynamo = new this.awsService.sdk.DynamoDB({ region });
    const stepFunctions = new this.awsService.sdk.StepFunctions({ region });

    // ESSE REQUIRE TEM QUE SER AQUI POIS TEM VARIAVEIS QUE SÃO USADAS LOGO NO IMPORT E ISSO GERA UM PROBLEMA CASO O AWS NÃO ESTEJA CONFIGURADO AINDA.
    // eslint-disable-next-line global-require
    const { updateResourceTags } = require("./update-resource-tag");

    await updateResourceTags({ SQS, lambda, dynamo, stepFunctions, Key });
  }
}

module.exports = ServerlessPlugin;
