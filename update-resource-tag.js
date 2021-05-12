/* eslint-disable no-await-in-loop */
/* eslint-disable consistent-return */
/* eslint-disable no-prototype-builtins */

function fromCurrentService(resource) {
    return resource.includes(`${process.env.serviceName}`);
  }
  
  function isCrawlerStepFunction(resource) {
    return resource.includes("-stateMachine");
  }
  
  function filterTableNames(tables) {
    return tables.filter((table) => {
      if (fromCurrentService(table)) return table;
    });
  }
  
  const tagStepFunction = async (stepFunctions, Key) => {
    try {
      const { stateMachines } = await stepFunctions.listStateMachines().promise();
      // break in chunks of 50 to avoit rate exceeded
      for (let i = 0; i < Object.keys(stateMachines).length; i += 50) {
        const tempStateMachines = stateMachines.slice(i, i + 50);
  
        await Promise.all(
          tempStateMachines.map(async (item) => {
            if (fromCurrentService(item.stateMachineArn) || isCrawlerStepFunction(item.name)) {
              const tagParams = {
                resourceArn: item.stateMachineArn,
              };
  
              const { tags: currentTags } = await stepFunctions.listTagsForResource(tagParams).promise();
  
              // only tag resources that don't have the tag yet
              if (!currentTags || !currentTags.some((tag) => tag.key === Key)) {
                tagParams.tags = [{ key: Key, value: item.name }];
                await stepFunctions.tagResource(tagParams).promise();
              }
            }
          })
        );
      }
  
      return Promise.resolve("All done");
    } catch (error) {
      return Promise.reject(error);
    }
  };
  
  const tagSQS = async (SQS, Key) => {
    try {
      const { QueueUrls } = await SQS.listQueues({ QueueNamePrefix: `${process.env.serviceName}` }).promise();
  
      // break in chunks of 50 to avoid rate exceeded
      for (let i = 0; i < Object.keys(QueueUrls).length; i += 50) {
        const tempQueueUrls = QueueUrls.slice(i, i + 50);
  
        await Promise.all(
          tempQueueUrls.map(async (item) => {
            const params = {
              QueueUrl: item,
            };
  
            const { Tags: currentTags } = await SQS.listQueueTags(params).promise();
            // only tag resources that don't have the tag yet
            if (!currentTags || !currentTags.hasOwnProperty(Key)) {
              params.Tags = { [Key]: `${item.split("/")[4]}` };
              await SQS.tagQueue(params).promise();
            }
          })
        );
      }
  
      return Promise.resolve("All done");
    } catch (error) {
      return Promise.reject(error);
    }
  };
  
  const tagLambda = async (lambda, Key) => {
    try {
      const { Functions } = await lambda.listFunctions().promise();
  
      await Promise.all(
        Functions.map(async (item) => {
          if (fromCurrentService(item.FunctionArn)) {
            const tagParams = {
              Resource: item.FunctionArn,
            };
  
            const { Tags: currentTags } = await lambda.listTags(tagParams).promise();
  
            // only tag resources that don't have the tag yet
            if (!currentTags || !currentTags.hasOwnProperty(Key)) {
              tagParams.Tags = {
                [Key]: item.FunctionName,
              };
              await lambda.tagResource(tagParams).promise();
            }
          }
        })
      );
      return Promise.resolve("All done");
    } catch (error) {
      return Promise.reject(error);
    }
  };
  
  const tagDynamoDB = async (dynamo, Key) => {
    try {
      let { TableNames } = await dynamo.listTables().promise();
      TableNames = filterTableNames(TableNames);
  
      await Promise.all(
        TableNames.map(async (item) => {
          const tagParams = {
            ResourceArn: `arn:aws:dynamodb:${process.env.region}:${process.env.awsId}:table/${item}`,
          };
  
          const { Tags: currentTags } = await dynamo.listTagsOfResource(tagParams).promise();
  
          // only tag resources that don't have the tag yet
          if (!currentTags && !currentTags.some((tag) => tag.Key === Key)) {
            tagParams.Tags = [{ Key, Value: `${item}` }];
            await dynamo.tagResource(tagParams).promise();
          }
        })
      );
      return Promise.resolve("All done");
    } catch (error) {
      return Promise.reject(error);
    }
  };
  
  module.exports.updateResourceTags = async ({ SQS, lambda, dynamo, stepFunctions, Key }) => {
    try {
      await tagStepFunction(stepFunctions, Key);
      await tagSQS(SQS, Key);
      await tagLambda(lambda, Key);
      await tagDynamoDB(dynamo, Key);
    } catch (error) {
      throw new Error(error);
    }
  };
  