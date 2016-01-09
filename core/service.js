/**
 * Created by kevin on 14/12/2015.
 */
import SubscribeBuilder from './builder';
import angular from 'angular';

export default class ngStompWebSocket {

    /*@ngNoInject*/
    constructor(settings, $q, $log, $rootScope, $timeout, Stomp) {
        this.settings = settings;
        this.$q = $q;
        this.$rootScope = $rootScope;
        this.$log = $log;
        this.Stomp = Stomp;
        this.$timeout = $timeout;
        this.connections = new Map();

        this.connect();
    }

    connect() {
        this.$setConnection();
        this.stompClient.connect(
            this.settings.login,
            this.settings.password,
            () => {
                this.deferred.resolve();
                this.$digestStompAction();
            },
            () => {
                this.$timeout(() => {
                    this.connect();
                    this.$reconnectAll()
                }, this.settings.timeOut);
            },
            this.settings.vhost
        );
        return this.promiseResult;
    }

    subscribe(url, callback, header = {}, scope, bodyInJson = false) {
        this.promiseResult.then(() => {
            this.$stompSubscribe(url, callback, header, scope, bodyInJson);
            this.$unRegisterScopeOnDestroy(scope, url);
        });
        return this;
    }

    subscribeTo(topic) {
        return new SubscribeBuilder(this, topic);
    }

    unsubscribe(url) {
        this.promiseResult.then(() => this.$stompUnSubscribe(url));
        return this;
    }

    send(queue, data, header = {}) {
        let sendDeffered = this.$q.defer();

        this.promiseResult.then(() => {
            this.stompClient.send(queue, header, JSON.stringify(data));
            sendDeffered.resolve();
        });

        return sendDeffered.promise;
    }

    disconnect() {
        let disconnectionPromise = this.$q.defer();
        this.stompClient.disconnect(() => {
            disconnectionPromise.resolve();
            this.$digestStompAction();
        });

        return disconnectionPromise.promise;
    }

    $stompSubscribe(queue, callback, header, scope, bodyInJson) {
        let subscription = this.stompClient.subscribe(queue, (message) => {
            if (bodyInJson)
                message.body = JSON.parse(message.body);
            callback(message);
            this.$digestStompAction();
        }, header);
        this.connections.set(queue, { sub : subscription, callback : callback, header : header, scope : scope, json : bodyInJson });
    }

    $stompUnSubscribe(queue) {
        let subscription = this.connections.get(queue).sub;
        subscription.unsubscribe();
        this.connections.delete(queue);
    }

    $digestStompAction() {
        !this.$rootScope.$$phase && this.$rootScope.$apply();
    }

    $setConnection() {
        this.stompClient = this.settings.class ? this.Stomp.over(new this.settings.class(this.settings.url)) : this.Stomp.client(this.settings.url);
        this.stompClient.debug = (this.settings.debug) ? this.$log.debug : angular.noop;
        if (angular.isDefined(this.settings.heartbeat)) {
            this.stompClient.heartbeat.outgoing = this.settings.heartbeat.outgoing;
            this.stompClient.heartbeat.incoming = this.settings.heartbeat.incoming;
        }
        this.deferred = this.$q.defer();
        this.promiseResult = this.deferred.promise;
    }

    $unRegisterScopeOnDestroy(scope, url) {
        if (scope !== undefined && angular.isFunction(scope.$on))
            scope.$on('$destroy', () => this.unsubscribe(url) );
    }

    $reconnectAll() {
        this.connections
            .forEach( (val, key) => this.subscribe(key, val.callback, val.header, val.scope, val.json) );
    }
}
