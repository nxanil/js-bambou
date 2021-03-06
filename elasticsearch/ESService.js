import objectPath from 'object-path';

import ESRESTConnection from './ESRESTConnection';
import ESTabify from './ESTabify';
import { getLogger } from '../Logger';
import NUTemplateParser from "../NUTemplateParser";
import { ESSearchConvertor } from 'vis-graphs/utils/helpers'

const ERROR_MESSAGE = 'unable to fetch data.'
export const SCROLL_TIME = '3m';

export default class ESService {
    constructor(host = null) {
        this._connection = new ESRESTConnection(host);
    }

    fetch = (configuration) => {
        try {
            return new Promise((resolve, reject) => {
                this._connection.makeRequest(configuration.query, configuration.scroll)
                    .then(response => resolve(this.parseResponse(response)))
                    .catch(error => {
                        if (!error.body) {
                            return reject(error);
                        } else {
                            getLogger().error(error.body.error.reason + ": " + error.body.error["resource.id"])
                            return reject(ERROR_MESSAGE);
                        }
                    });
            });
        } catch (error) {
            return Promise.reject(error);
        }
    }

    // process response for scroll & search response
    parseResponse = (response = {}) => {
        const tabify = new ESTabify();
        let results = null;
        // if scrolling is enabled then update next query for fetching data via scrolling
        if (response.hits.hits.length && response._scroll_id) {
            results = {
                response: tabify.process(response),
                nextPage: {
                    scroll_id: response._scroll_id,
                },
                length: response.hits.total
            };

        } else {
            results = {
                response: tabify.process(response),
            };
        }

        return results;
    }

    getRequestID = (configuration, context = {}) => {
        const tmpConfiguration = NUTemplateParser.parameterizedConfiguration(configuration, context);

        if (!tmpConfiguration)
            return;

        const parameters = NUTemplateParser.getUsedParameters(configuration, context);

        if (Object.keys(parameters).length === 0)
            return configuration.id;

        return `${configuration.vizID}-${configuration.id}[${JSON.stringify(parameters)}]`;

    }

    tabify = (data) => {
        const tabify = new ESTabify();
        return tabify.process(data);
    }

    // Add custom sorting into ES query
    addSorting = (queryConfiguration, sort) => {

        if (!queryConfiguration)
            return null

        if (!sort || sort.order === '')
            return queryConfiguration;

        queryConfiguration.query.body.sort = {
            [sort.column]: {
                order: sort.order
            }
        };

        return queryConfiguration;
    }

    // Add custom searching from searchbox into ES query
    addSearching = (queryConfiguration, search) => {

        if (!queryConfiguration)
            return null;

        if (!search)
            return queryConfiguration;

        if (search.length) {
            objectPath.push(queryConfiguration, 'query.body.query.bool.must', ESSearchConvertor(search));
        }

        return queryConfiguration;
    }

    getPageSizePath = () =>  'query.body.size';

    updatePageSize = (queryConfiguration, pageSize) => {
        objectPath.set(queryConfiguration, this.getPageSizePath(), pageSize);
        return queryConfiguration;
    }

    getNextPageQuery = (queryConfiguration, nextPage) => {
        return Object.assign(queryConfiguration, {
            query: {
                scroll: SCROLL_TIME,
                scroll_id: nextPage.scroll_id
            }
        })
    }
}
