/* Copyright 2015 Realm Inc - All Rights Reserved
 * Proprietary and Confidential
 */

'use strict';

var Realm = require('realm');
var BaseTest = require('./base-test');
var TestCase = require('./asserts');
var schemas = require('./schemas');
var util = require('./util');

module.exports = BaseTest.extend({
    testRealmConstructorPath: function() {
        TestCase.assertThrows(function() {
            new Realm('/invalidpath');
        }, 'Realm cannot be created with an invalid path');
        TestCase.assertThrows(function() {
            new Realm(util.realmPathForFile('test1.realm'), 'invalidArgument');
        }, 'Realm constructor can only have 0 or 1 argument(s)');

        var defaultRealm = new Realm({schema: []});
        TestCase.assertEqual(defaultRealm.path, Realm.defaultPath);

        var defaultRealm2 = new Realm();
        TestCase.assertEqual(defaultRealm2.path, Realm.defaultPath);

        var testPath = util.realmPathForFile('test1.realm');
        var realm = new Realm({schema: [], path: testPath});
        //TestCase.assertTrue(realm instanceof Realm);
        TestCase.assertEqual(realm.path, testPath);

        var testPath2 = util.realmPathForFile('test2.realm');
        var realm2 = new Realm({schema: [], path: testPath2});
        //TestCase.assertTrue(realm2 instanceof Realm);
        TestCase.assertEqual(realm2.path, testPath2);
    },

    testRealmConstructorSchemaVersion: function() {
        var defaultRealm = new Realm({schema: []});
        TestCase.assertEqual(defaultRealm.schemaVersion, 0);

        TestCase.assertThrows(function() {
            new Realm({schemaVersion: 1});
        }, "Realm already opened at a different schema version");
        
        TestCase.assertEqual(new Realm().schemaVersion, 0);
        TestCase.assertEqual(new Realm({schemaVersion: 0}).schemaVersion, 0);

        var testPath = util.realmPathForFile('test1.realm');
        var realm = new Realm({path: testPath, schema: [], schemaVersion: 1});
        TestCase.assertEqual(realm.schemaVersion, 1);
        // FIXME - enable once Realm exposes a schema object
        //TestCase.assertEqual(realm.schema.length, 0);
 
        realm.close();
        // FIXME - enable once realm initialization supports schema comparison
        // TestCase.assertThrows(function() {
        //     realm = new Realm({path: testPath, schema: [schemas.TestObject], schemaVersion: 1});
        // }, "schema changes require updating the schema version");

        realm = new Realm({path: testPath, schema: [schemas.TestObject], schemaVersion: 2});
        realm.write(function() {
            realm.create('TestObject', {doubleCol: 1});
        });
        TestCase.assertEqual(realm.objects('TestObject')[0].doubleCol, 1)
    },

    testRealmConstructorSchemaValidation: function() {
        TestCase.assertThrows(function() {
            new Realm({schema: schemas.AllTypes});
        }, 'The schema should be an array');

        TestCase.assertThrows(function() {
            new Realm({schema: ['SomeType']});
        }, 'The schema should be an array of objects');

        TestCase.assertThrows(function() {
            new Realm({schema: [{}]});
        }, 'The schema should be an array of ObjectSchema objects');

        TestCase.assertThrows(function() {
            new Realm({schema: [{name: 'SomeObject'}]});
        }, 'The schema should be an array of ObjectSchema objects');

        TestCase.assertThrows(function() {
            new Realm({schema: [{properties: {intCol: Realm.Types.INT}}]});
        }, 'The schema should be an array of ObjectSchema objects');
    },

    testDefaultPath: function() {
        var defaultRealm = new Realm({schema: []});
        TestCase.assertEqual(defaultRealm.path, Realm.defaultPath);

        var newPath = util.realmPathForFile('default2.realm');
        Realm.defaultPath = newPath;
        defaultRealm = new Realm({schema: []});
        TestCase.assertEqual(defaultRealm.path, newPath, "should use updated default realm path");
        TestCase.assertEqual(Realm.defaultPath, newPath, "defaultPath should have been updated");
    },

    testRealmCreate: function() {
        var realm = new Realm({schema: [schemas.IntPrimary, schemas.AllTypes, schemas.TestObject]});

        TestCase.assertThrows(function() {
            realm.create('TestObject', {doubleCol: 1});
        }, 'can only create inside a write transaction');

        realm.write(function() {
            realm.create('TestObject', {doubleCol: 1});
            realm.create('TestObject', {doubleCol: 2});
        });

        var objects = realm.objects('TestObject');
        TestCase.assertEqual(objects.length, 2, 'wrong object count');
        TestCase.assertEqual(objects[0].doubleCol, 1, 'wrong object property value');
        TestCase.assertEqual(objects[1].doubleCol, 2, 'wrong object property value');

        // test int primary object
        realm.write(function() {
            var obj0 = realm.create('IntPrimaryObject', {
                primaryCol: 0,
                valueCol: 'val0',
            });

            TestCase.assertThrows(function() {
                realm.create('IntPrimaryObject', {
                    primaryCol: 0,
                    valueCol: 'val0',
                });
            }, 'cannot create object with conflicting primary key');

            realm.create('IntPrimaryObject', {
                primaryCol: 1,
                valueCol: 'val1',
            }, true);

            var objects = realm.objects('IntPrimaryObject');
            TestCase.assertEqual(objects.length, 2);

            realm.create('IntPrimaryObject', {
                primaryCol: 0,
                valueCol: 'newVal0',
            }, true);

            TestCase.assertEqual(obj0.valueCol, 'newVal0');
            TestCase.assertEqual(objects.length, 2);

            realm.create('IntPrimaryObject', {primaryCol: 0}, true);
            TestCase.assertEqual(obj0.valueCol, 'newVal0');
        });

        // test upsert with all type and string primary object
        realm.write(function() {
            var values = {
                primaryCol: '0',
                boolCol:    true,
                intCol:     1,
                floatCol:   1.1,
                doubleCol:  1.11,
                stringCol:  '1',
                dateCol:    new Date(1),
                dataCol:    new ArrayBuffer(1),
                objectCol:  {doubleCol: 1},
                arrayCol:   [],
            };

            var obj0 = realm.create('AllTypesObject', values);

            TestCase.assertThrows(function() {
                realm.create('AllTypesObject', values);
            }, 'cannot create object with conflicting primary key');

            var obj1 = realm.create('AllTypesObject', {
                primaryCol: '1',
                boolCol:    false,
                intCol:     2,
                floatCol:   2.2,
                doubleCol:  2.22,
                stringCol:  '2',
                dateCol:    new Date(2),
                dataCol:    new ArrayBuffer(2),
                objectCol:  {doubleCol: 0},
                arrayCol:   [{doubleCol: 2}],
            }, true);

            var objects = realm.objects('AllTypesObject');
            TestCase.assertEqual(objects.length, 2);

            realm.create('AllTypesObject', {
                primaryCol: '0',
                boolCol:    false,
                intCol:     2,
                floatCol:   2.2,
                doubleCol:  2.22,
                stringCol:  '2',
                dateCol:    new Date(2),
                dataCol:    new ArrayBuffer(2),
                objectCol:  null,
                arrayCol:   [{doubleCol: 2}],
            }, true);

            TestCase.assertEqual(objects.length, 2);
            TestCase.assertEqual(obj0.stringCol, '2');
            TestCase.assertEqual(obj0.boolCol, false);
            TestCase.assertEqual(obj0.intCol, 2);
            TestCase.assertEqualWithTolerance(obj0.floatCol, 2.2, 0.000001);
            TestCase.assertEqualWithTolerance(obj0.doubleCol, 2.22, 0.000001);
            TestCase.assertEqual(obj0.dateCol.getTime(), 2);
            TestCase.assertEqual(obj0.dataCol.byteLength, 2);
            TestCase.assertEqual(obj0.objectCol, null);
            TestCase.assertEqual(obj0.arrayCol.length, 1);

            realm.create('AllTypesObject', {primaryCol: '0'}, true);
            realm.create('AllTypesObject', {primaryCol: '1'}, true);
            TestCase.assertEqual(obj0.stringCol, '2');
            TestCase.assertEqual(obj0.objectCol, null);
            TestCase.assertEqual(obj1.objectCol.doubleCol, 0);

            realm.create('AllTypesObject', {
                primaryCol: '0',
                stringCol:  '3',
                objectCol:  {doubleCol: 0},
            }, true);

            TestCase.assertEqual(obj0.stringCol, '3');
            TestCase.assertEqual(obj0.boolCol, false);
            TestCase.assertEqual(obj0.intCol, 2);
            TestCase.assertEqualWithTolerance(obj0.floatCol, 2.2, 0.000001);
            TestCase.assertEqualWithTolerance(obj0.doubleCol, 2.22, 0.000001);
            TestCase.assertEqual(obj0.dateCol.getTime(), 2);
            TestCase.assertEqual(obj0.dataCol.byteLength, 2);
            TestCase.assertEqual(obj0.objectCol.doubleCol, 0);
            TestCase.assertEqual(obj0.arrayCol.length, 1);

            realm.create('AllTypesObject', {primaryCol: '0', objectCol: undefined}, true);
            realm.create('AllTypesObject', {primaryCol: '1', objectCol: null}, true);
            TestCase.assertEqual(obj0.objectCol, null);
            TestCase.assertEqual(obj1.objectCol, null);
        });
    },

    testRealmCreateWithDefaults: function() {
        var realm = new Realm({schema: [schemas.DefaultValues, schemas.TestObject]});

        realm.write(function() {
            var obj = realm.create('DefaultValuesObject', {});
            var properties = schemas.DefaultValues.properties;

            TestCase.assertEqual(obj.boolCol, properties.boolCol.default);
            TestCase.assertEqual(obj.intCol, properties.intCol.default);
            TestCase.assertEqualWithTolerance(obj.floatCol, properties.floatCol.default, 0.000001);
            TestCase.assertEqualWithTolerance(obj.doubleCol, properties.doubleCol.default, 0.000001);
            TestCase.assertEqual(obj.stringCol, properties.stringCol.default);
            TestCase.assertEqual(obj.dateCol.getTime(), properties.dateCol.default.getTime());
            TestCase.assertEqual(obj.dataCol.byteLength, properties.dataCol.default.byteLength);
            TestCase.assertEqual(obj.objectCol.doubleCol, properties.objectCol.default.doubleCol);
            TestCase.assertEqual(obj.nullObjectCol, null);
            TestCase.assertEqual(obj.arrayCol.length, properties.arrayCol.default.length);
            TestCase.assertEqual(obj.arrayCol[0].doubleCol, properties.arrayCol.default[0].doubleCol);
        });
    },

    testRealmDelete: function() {
        var realm = new Realm({schema: [schemas.TestObject]});

        realm.write(function() {
            for (var i = 0; i < 10; i++) {
                realm.create('TestObject', {doubleCol: i});
            }
        });

        var objects = realm.objects('TestObject');
        TestCase.assertThrows(function() {
            realm.delete(objects[0]);
        }, 'can only delete in a write transaction');

        realm.write(function() {
            TestCase.assertThrows(function() {
                realm.delete();
            });

            realm.delete(objects[0]);
            TestCase.assertEqual(objects.length, 9, 'wrong object count');
            TestCase.assertEqual(objects[0].doubleCol, 9, "wrong property value");
            TestCase.assertEqual(objects[1].doubleCol, 1, "wrong property value");

            realm.delete([objects[0], objects[1]]);
            TestCase.assertEqual(objects.length, 7, 'wrong object count');
            TestCase.assertEqual(objects[0].doubleCol, 7, "wrong property value");
            TestCase.assertEqual(objects[1].doubleCol, 8, "wrong property value");

            var threeObjects = realm.objects('TestObject', "doubleCol < 5");
            TestCase.assertEqual(threeObjects.length, 3, "wrong results count");
            realm.delete(threeObjects);
            TestCase.assertEqual(objects.length, 4, 'wrong object count');
            TestCase.assertEqual(threeObjects.length, 0, 'threeObject should have been deleted');
        });
    },

    testDeleteAll: function() {
        var realm = new Realm({schema: [schemas.TestObject, schemas.IntPrimary]});

        realm.write(function() {
            realm.create('TestObject', {doubleCol: 1});
            realm.create('TestObject', {doubleCol: 2});
            realm.create('IntPrimaryObject', {primaryCol: 2, valueCol: 'value'});
        });

        TestCase.assertEqual(realm.objects('TestObject').length, 2);
        TestCase.assertEqual(realm.objects('IntPrimaryObject').length, 1);

        TestCase.assertThrows(function() {
            realm.deleteAll();
        }, 'can only deleteAll in a write transaction');

        realm.write(function() {
            realm.deleteAll();
        });

        TestCase.assertEqual(realm.objects('TestObject').length, 0);
        TestCase.assertEqual(realm.objects('IntPrimaryObject').length, 0);
    },

    testRealmObjects: function() {
        var realm = new Realm({schema: [schemas.PersonObject, schemas.DefaultValues, schemas.TestObject]});
        realm.write(function() {
            realm.create('PersonObject', {name: 'Ari', age: 10});
            realm.create('PersonObject', {name: 'Tim', age: 11});
            realm.create('PersonObject', {name: 'Bjarne', age: 12});
            realm.create('PersonObject', {name: 'Alex', age: 12, married: true});
        });

        TestCase.assertThrows(function() { 
            realm.objects();
        });
        TestCase.assertThrows(function() { 
            realm.objects([]);
        });
        TestCase.assertThrows(function() { 
            realm.objects('InvalidClass');
        });
        TestCase.assertThrows(function() { 
            realm.objects('PersonObject', 'invalid query');
        });
        TestCase.assertThrows(function() { 
            realm.objects('PersonObject', []);
        });

        TestCase.assertEqual(realm.objects('PersonObject', "truepredicate").length, 4);
        TestCase.assertEqual(realm.objects('PersonObject').length, 4);
        TestCase.assertEqual(realm.objects('PersonObject', 'age = 11').length, 1);
        TestCase.assertEqual(realm.objects('PersonObject', 'age = 11')[0].name, 'Tim');
        TestCase.assertEqual(realm.objects('PersonObject', 'age = 12').length, 2);
        TestCase.assertEqual(realm.objects('PersonObject', 'age = 13').length, 0);
        TestCase.assertEqual(realm.objects('PersonObject', 'age < 12').length, 2);
        TestCase.assertEqual(realm.objects('PersonObject', 'age > 10 && age < 13').length, 3);
        TestCase.assertEqual(realm.objects('PersonObject', 'age >= 11 && age < 13').length, 3);
        TestCase.assertEqual(realm.objects('PersonObject', 'name = "Tim"').length, 1);
        TestCase.assertEqual(realm.objects('PersonObject', 'name = \'Tim\'').length, 1);
        TestCase.assertEqual(realm.objects('PersonObject', 'married == TRUE').length, 1);
        TestCase.assertEqual(realm.objects('PersonObject', 'married == false').length, 3);

        TestCase.assertEqual(realm.objects('PersonObject', 'name = $0', 'Tim').length, 1);
        TestCase.assertEqual(realm.objects('PersonObject', 'age > $1 && age < $0', 13, 10).length, 3);
        TestCase.assertThrows(function() {
            realm.objects('PersonObject', 'age > $2 && age < $0', 13, 10)
        });

        realm.write(function() {
            realm.create('DefaultValuesObject', {'dateCol': new Date(3)});
            realm.create('DefaultValuesObject', {'dateCol': new Date(4)});
            realm.create('DefaultValuesObject', {'dateCol': new Date(5)});
        });

        TestCase.assertEqual(realm.objects('DefaultValuesObject', 'dateCol > $0', new Date(4)).length, 1);
        TestCase.assertEqual(realm.objects('DefaultValuesObject', 'dateCol <= $0', new Date(4)).length, 2);
    },

    testNotifications: function() {
        var realm = new Realm({schema: []});
        var notificationCount = 0;
        var notificationName;

        realm.addListener('change', function(realm, name) {
            notificationCount++;
            notificationName = name;
        });

        TestCase.assertEqual(notificationCount, 0);
        realm.write(function() {});
        TestCase.assertEqual(notificationCount, 1);
        TestCase.assertEqual(notificationName, 'change');

        var secondNotificationCount = 0;
        function secondNotification(realm, name) {
            secondNotificationCount++;
        }

        // The listener should only be added once.
        realm.addListener('change', secondNotification);
        realm.addListener('change', secondNotification);

        realm.write(function() {});
        TestCase.assertEqual(notificationCount, 2);
        TestCase.assertEqual(secondNotificationCount, 1);

        realm.removeListener('change', secondNotification);
        realm.write(function() {});
        TestCase.assertEqual(notificationCount, 3);
        TestCase.assertEqual(secondNotificationCount, 1);

        realm.removeAllListeners();
        realm.write(function() {});
        TestCase.assertEqual(notificationCount, 3);
        TestCase.assertEqual(secondNotificationCount, 1);

        TestCase.assertThrows(function() {
            realm.addListener('invalid', function() {});
        });

        realm.addListener('change', function() {
            throw new Error('error');
        });

        TestCase.assertThrows(function() {
            realm.write(function() {});
        });
    },
});
