import corsMiddleware from 'cors';
import bodyParser from 'body-parser';
import { graphqlUploadExpress } from 'graphql-upload';
import { graphqlExpress } from 'apollo-server-express/dist/expressApollo';
import { renderPlaygroundPage } from '@apollographql/graphql-playground-html';
import { execute, subscribe } from 'graphql';
import { SubscriptionServer } from 'subscriptions-transport-ws';
import { handleParseHeaders } from '../middlewares';
import requiredParameter from '../requiredParameter';
import { ParseGraphQLSchema } from './ParseGraphQLSchema';

class ParseGraphQLServer {
  constructor(parseServer, config = {}) {
    this.parseServer =
      parseServer ||
      requiredParameter('You must provide a parseServer instance!');
    config.graphQLPath =
      config.graphQLPath ||
      requiredParameter('You must provide a config.graphQLPath!');
    this.config = config;
    this.parseGraphQLSchema = new ParseGraphQLSchema(
      this.parseServer.config.databaseController
    );
  }

  async _getGraphQLOptions(req) {
    return {
      schema: await this.parseGraphQLSchema.load(),
      context: {
        info: req.info,
        config: req.config,
        auth: req.auth,
      },
    };
  }

  applyGraphQL(app) {
    app.use(this.config.graphQLPath, graphqlUploadExpress());
    app.use(this.config.graphQLPath, corsMiddleware());
    app.use(this.config.graphQLPath, bodyParser.json());
    app.use(this.config.graphQLPath, handleParseHeaders);
    app.use(
      this.config.graphQLPath,
      graphqlExpress(async req => await this._getGraphQLOptions(req))
    );
  }

  applyPlayground(app) {
    app.get(
      this.config.playgroundPath ||
        requiredParameter(
          'You must provide a config.playgroundPath to applyGround!'
        ),
      (_req, res) => {
        res.setHeader('Content-Type', 'text/html');
        res.write(
          renderPlaygroundPage({
            endpoint: this.config.graphQLPath,
            subscriptionEndpoint: this.config.subscriptionsPath,
          })
        );
        res.end();
      }
    );
  }

  createSubscriptions(server) {
    SubscriptionServer.create(
      {
        execute,
        subscribe,
        onOperation: async (_message, params, webSocket) =>
          Object.assign(
            {},
            params,
            await this._getGraphQLOptions(webSocket.upgradeReq)
          ),
      },
      {
        server,
        path:
          this.config.subscriptionsPath ||
          requiredParameter(
            'You must provide a config.subscriptionsPath to createSubscriptions!'
          ),
      }
    );
  }
}

export { ParseGraphQLServer };
