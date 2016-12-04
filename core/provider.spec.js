/**
 * Created by kevin on 20/12/2015.
 */
//import {describe, it, expect} from 'jasmine';
import Provider from './provider';
import angular from 'angular';

describe('Provider', () => {

    let provider,
        Stomp = { client : x => x, over : x => x},
        $q = { defer : x => x, reject : x => x },
        defered = { promise : 'promise', reject : x => x},
        stompClient = { connect : x => x, heartbeat : {}},
        $log = {},
        $rootScope = {},
        $timeout;

    beforeEach(() => {
        $timeout = jasmine.createSpy('$timeout');
        spyOn($q, 'defer').and.returnValue(defered);
        spyOn($q, 'reject').and.returnValue(defered);
        spyOn(Stomp, 'client').and.returnValue(stompClient);
        spyOn(Stomp, 'over').and.returnValue(stompClient);
        provider = new Provider();
    });

    it('should be auto configured', () => {
        const connectionUrl = '/anUrl';

        let ngStomp = provider
            .url(connectionUrl)
            .$get($q, $log, $rootScope, $timeout, Stomp);

        expect(ngStomp.settings)
            .toEqual(angular.extend(
                {},
                { url : connectionUrl },
                { timeOut : 5000, heartbeat : { outgoing : 10000, incoming : 10000 }, autoConnect : true }
            ));
    });

    it('should be configured by fluent api', () => {
        const connectionUrl = '/anotherUrl',
            login = 'login', password = 'password',
            vhost = 'vhost',
            headers = {foo: 'bar'};

        let ngStomp = provider
            .url(connectionUrl)
            .credential(login, password)
            .reconnectAfter(10)
            .class(angular.noop)
            .debug(true)
            .vhost(vhost)
            .heartbeat(1, 2)
            .autoConnect(false)
            .headers(headers)
            .$get($q, $log, $rootScope, $timeout, Stomp);

        expect(ngStomp.settings).toEqual({
            "timeOut" : 10000,
            "url": connectionUrl,
            "login": login,
            "password": password,
            "class": angular.noop,
            "debug": true,
            "vhost": vhost,
            "heartbeat": {
                "outgoing": 1,
                "incoming": 2
            },
            "headers": headers,
            "autoConnect" : false
        });
    });

    it('should be configured by settings', () => {
        let settingsObject = { an : 'object'};
        provider.setting(settingsObject);
        expect(settingsObject).toBe(provider.settings);
    });

    it('should have auto-connect parameter', () => {
        let settingsObject = { an : 'object'};
        provider.setting(settingsObject);
        expect(settingsObject).toBe(provider.settings);
    });
});
