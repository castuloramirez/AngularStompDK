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
        this.connections = [];

        this.$initConnectionState();
        if (settings.autoConnect) {
            this.connect();
        }
    }

    connect() {
        this.$initConnectionState();
        return this.$connect();
    }

    $initConnectionState() {
        this.deferred && this.deferred.reject();
        this.deferred = this.$q.defer();
        this.connectionState = this.deferred.promise;
    }

    $connect() {
        this.$setConnection();

        let successCallback = () => this.deferred.resolve();
        let errorCallback = () => {
            this.deferred.reject();
            this.$initConnectionState();
            this.settings.timeOut >= 0 && this.$timeout(() => {
                this.$connect();
                this.$reconnectAll();
            }, this.settings.timeOut);
        };

        if (angular.isDefined(this.settings.headers)) {
            this.stompClient.connect(
                this.settings.headers,
                successCallback,
                errorCallback
            )
        } else {
            this.stompClient.connect(
                this.settings.login,
                this.settings.password,
                successCallback,
                errorCallback,
                this.settings.vhost
            );
        }


        return this.connectionState;
    }

    subscribe(queue, callback, header = {}, scope, json = false, digest) {
        this.connectionState
            .then(
                () => this.$stompSubscribe(queue, callback, header, scope, json, digest),
                () => this.$$addToConnectionQueue({ queue, callback, header, scope, json, digest })
            )
        ;
        return this;
    }

    subscribeTo(topic) {
        return new SubscribeBuilder(this, topic);
    }

    /* Deprecated */
    unsubscribe(url) {
        this.connectionState.then(() => this.$stompUnSubscribe(url));
        return this;
    }

    send(queue, data, header = {}) {
        let sendDeffered = this.$q.defer();

        this.connectionState.then(() => {
            this.stompClient.send(queue, header, JSON.stringify(data));
            sendDeffered.resolve();
        });

        return sendDeffered.promise;
    }

    disconnect() {
        let disconnectionPromise = this.$q.defer();
        this.stompClient.disconnect(() => {
            disconnectionPromise.resolve();
        });

        return disconnectionPromise.promise;
    }

    set login(login) {
        this.settings.login = login;
    }

    set password(password) {
        this.settings.password = password;
    }

    set url(url) {
        this.settings.url = url;
    }

    $stompSubscribe(queue, callback, header, scope = this.$rootScope, json, digest) {
        let sub = this.stompClient.subscribe(queue, message => {
            if (json) message.body = JSON.parse(message.body);

            if (digest) {
                scope.$applyAsync(() => callback(message));
            } else {
                callback(message);
            }
        }, header);

        let connection = { queue, sub, callback, header, scope, json, digest};
        this.$$addToConnectionQueue(connection);
        this.$unRegisterScopeOnDestroy(connection);
    }

    $stompUnSubscribe(queue) {
        this.connections
            .filter(c => c.queue === queue)
            .forEach(c => c.sub.unsubscribe());

        this.connections = this.connections.filter(c => c.queue != queue);
    }

    $setConnection() {
        this.stompClient = this.settings.class ? this.Stomp.over(new this.settings.class(this.settings.url)) : this.Stomp.client(this.settings.url);
        this.stompClient.debug = (this.settings.debug) ? this.$log.debug : angular.noop;
        if (angular.isDefined(this.settings.heartbeat)) {
            this.stompClient.heartbeat.outgoing = this.settings.heartbeat.outgoing;
            this.stompClient.heartbeat.incoming = this.settings.heartbeat.incoming;
        }
    }

    $unRegisterScopeOnDestroy(connection) {
        if (connection.scope !== undefined && angular.isFunction(connection.scope.$on))
            connection.scope.$on('$destroy', () => this.$$unSubscribeOf(connection) );
    }

    $reconnectAll() {
        let connections = this.connections;
        this.connections = [];
        // during subscription each connection will be added to this.connections array again
        connections.forEach(c => this.subscribe(c.queue, c.callback, c.header, c.scope, c.json, c.digest));
    }

    $$unSubscribeOf(connection) {
        this.connections
            .filter(c => this.$$connectionEquality(c, connection))
            .forEach(c => c.sub.unsubscribe());

        this.connections = this.connections.filter(c => !this.$$connectionEquality(c, connection));
    }

    $$addToConnectionQueue(connection) {
        this.connections.push(connection);
    }

    $$connectionEquality(c1, c2) {
        return c1.queue === c2.queue
            && c1.callback === c2.callback
            && c1.header === c2.header
            && c1.scope === c2.scope
            && c1.digest === c2.digest;
    }
}