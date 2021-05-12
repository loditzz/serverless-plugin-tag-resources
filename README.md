# serverless-plugin-tag-resources

Tags are very useful, specially for billing. This plugin will create a custom tag key and the value will be the resource's name.


## Installing

    npm install serverless-plugin-tag-resources
## serverless.yml   
  
    custom:
      customTagKey: "Tag key"
    plugins:
      - serverless-plugin-tag-resources