'use strict';

const test = require('tape').test;
const rewire = require("rewire");
const util = require('util');

const CGateClient = rewire('../cgate-client.js');

const _parseLine = CGateClient.__get__('_parseLine');
const _rawToPercent = CGateClient.__get__('_rawToPercent');

//==========================================================================================
//  Illegal Lines
//==========================================================================================

test('_parseLine: bad input', function (assert) {
	assert.plan(4);
	
	assert.throws(function () {
		_parseLine(`rooly ill-formed input`);
	});
	
	assert.throws(function () {
		_parseLine(`#e# the quick brown fox`);
	});
	
	assert.throws(function () {
		_parseLine(`#s# 200 status message`);
	});
	
	assert.throws(function () {
		_parseLine(`lighting on //SHAC/254/56/190  #sourceunit=81 OID=3dfd77e0-c4aa-1034-9f54-fbb6c098d608`);
	});
	
	assert.end();
});


//==========================================================================================
//  Events
//==========================================================================================


test('parse event: network message', function (assert) {
	assert.plan(3);
	
	let event = _parseLine(`#e# 20170204-160655.767 756 //SHAC/254 3dfc3f60-c4aa-1034-9e98-fbb6c098d608 SyncState=syncing`);
	assert.equal(event.type, `event`);
	assert.equal(event.code, 756);
	assert.false(event.processed);
	
	assert.end();
});

test('parse event: new level', function (assert) {
	assert.plan(6);
	
	let event = _parseLine(`#e# 20170204-160545.608 730 //SHAC/254/56/116 3df8bcf0-c4aa-1034-9f0a-fbb6c098d608 new level=43 sourceunit=74 ramptime=10`);
	assert.equal(event.code, 730);
	assert.equal(event.netId.toString(), `//SHAC/254/56/116`);
	assert.equal(event.level, 17);
	assert.equal(event.sourceunit, 74);
	assert.equal(event.ramptime, 10);
	assert.true(event.processed);
	
	assert.end();
});

test('parse response: value is float', function (assert) {
	assert.plan(3);
	
	let event = _parseLine(`#e# 20170204-160545.608 730 //SHAC/254/56/116 3df8bcf0-c4aa-1034-9f0a-fbb6c098d608 new foo=6.5020`);
	assert.equal(event.type, `event`);
	assert.equal(event.foo, 6.502);
	assert.true(event.processed);
	
	assert.end();
});

test('parse event: bad new level', function (assert) {
	assert.plan(3);
	
	assert.throws(function () {
		_parseLine(`#e# 20170204-160545.608 730 //SHAC/254/56/116 3df8bcf0-c4aa-1034-9f0a-fbb6c098d608 new level=abc sourceunit=74 ramptime=10`);
	});
	
	assert.throws(function () {
		_parseLine(`#e# 20170204-160545.608 730 //SHAC/254/56/116 3df8bcf0-c4aa-1034-9f0a-fbb6c098d608 level=43 sourceunit=74 ramptime=10`);
	});
	
	assert.throws(function () {
		_parseLine(`#e# 20170204-160545.608 730 //SHAC/254/56/116 3df8bcf0-c4aa-1034-9f0a-fbb6c098d608 new level=43 sourceunit= ramptime=10`);
	});
	
	assert.end();
});

test('parse event: application message missing remainder', function (assert) {
	assert.plan(1);
	
	assert.throws(function () {
		_parseLine(`#e# 20170204-130934.821 702 //SHAC/254/208/24 - [security]`);
	});
	
	assert.end();
});

test('parse event: security group arm_not_ready', function (assert) {
	assert.plan(7);
	
	let event = _parseLine(`#e# 20170204-130934.821 702 //SHAC/254/208/24 - [security] arm_not_ready sourceUnit=213`);
	assert.equal(event.time, `20170204-130934.821`);
	assert.equal(event.code, 702);
	assert.equal(event.netId.toString(), `//SHAC/254/208/24`);
	assert.equal(event.application, `security`);
	assert.equal(event.remainder[0], `arm_not_ready`);
	assert.equal(event.sourceUnit, 213);
	assert.true(event.processed);
	
	assert.end();
});

test('parse event: security zone_unsealed', function (assert) {
	assert.plan(5);
	
	let event = _parseLine(`#e# 20170204-130934.821 702 //BVC13/254/208/3 - [security] zone_unsealed sourceUnit=8`);
	assert.equal(event.type, `event`);
	assert.equal(event.netId.toString(), `//BVC13/254/208/3`);
	assert.equal(event.application, `security`);
	assert.equal(event.level, 100);		// speacial meaning for sealed
	assert.true(event.processed);
	
	assert.end();
});

test('parse event: security zone_sealed special handing', function (assert) {
	assert.plan(5);
	
	let event = _parseLine(`#e# 20170204-130934.821 702 //BVC13/254/208/3 - [security] zone_sealed sourceUnit=8`);
	assert.equal(event.type, `event`);
	assert.equal(event.netId.toString(), `//BVC13/254/208/3`);
	assert.equal(event.application, `security`);
	assert.equal(event.level, 0);		// speacial meaning for sealed
	assert.true(event.processed);
	
	assert.end();
});

test('parse event: security application system_arm', function (assert) {
	assert.plan(8);
	
	let event = _parseLine(`#e# 20170204-130934.821 702 //SHAC/254/208 3dfc8d80-c4aa-1034-9fa5-fbb6c098d608 [security] system_arm 1 sourceUnit=213`);
	assert.equal(event.time, `20170204-130934.821`);
	assert.equal(event.code, 702);
	assert.equal(event.netId.toString(), `//SHAC/254/208`);
	assert.equal(event.application, `security`);
	assert.equal(event.remainder[0], `system_arm`);
	assert.equal(event.remainder[1], `1`);
	assert.equal(event.sourceUnit, 213);
	assert.true(event.processed);
	
	assert.end();
});

test('parse event: heartbeat, not processed', function (assert) {
	assert.plan(4);
	
	let event = _parseLine(`#e# 20170206-134427.023 700 cgate - Heartbeat.`);
	assert.equal(event.time, `20170206-134427.023`);
	assert.equal(event.code, 700);
	assert.equal(event.message, `cgate - Heartbeat.`);
	assert.false(event.processed);
	
	assert.end();
});

test('parse event: no milliseconds', function (assert) {
	assert.plan(4);
	
	let event = _parseLine(`#e# 20170206-134427 700 cgate - Heartbeat.`);
	assert.equal(event.time, `20170206-134427`);
	assert.equal(event.code, 700);
	assert.equal(event.message, `cgate - Heartbeat.`);
	assert.false(event.processed);
	
	assert.end();
});

//==========================================================================================
//  Response
//==========================================================================================

test('parse response: 200', function (assert) {
	assert.plan(4);

	let response = _parseLine(`[123] 200 OK: //SHAC/254/56/3`);
	assert.equal(response.type, `response`);
	assert.equal(response.commandId, 123);
	assert.equal(response.code, 200);
	assert.true(response.processed);
	
	assert.end();
});

test('parse response: 300', function (assert) {
	assert.plan(6);
	
	let response = _parseLine(`[456] 300 //SHAC/254/56/3: level=129`);
	assert.equal(response.type, `response`);
	assert.equal(response.commandId, 456);
	assert.equal(response.code, 300);
	assert.equal(response.netId.toString(), `//SHAC/254/56/3`);
	assert.equal(response.level, 51);	// 129 raw = 51%
	assert.true(response.processed);
	
	assert.end();
});

test('parse response: bad level', function (assert) {
	assert.plan(4);
	
	assert.throws(function () {
		_parseLine(`[456] 300 //SHAC/254/56/3: level=abc`);
	});
	
	assert.throws(function () {
		_parseLine(`[456] 300 //SHAC/254/56/3: level=-1`);
	});
	
	assert.throws(function () {
		_parseLine(`[456] 300 //SHAC/254/56/3: level=1000`);
	});
	
	assert.throws(function () {
		_parseLine(`[456] 300 //SHAC/254/56/3: level=300`);
	});
	
	assert.end();
});

test('parse response: 201', function (assert) {
	assert.plan(4);
	
	let response = _parseLine(`[789] 201 some string we don't expect`);
	assert.equal(response.type, `response`);
	assert.equal(response.commandId, 789);
	assert.equal(response.code, 201);
	assert.false(response.processed);
	
	assert.end();
});


//==========================================================================================
//  utils
//==========================================================================================

test('_rawToPercent bounds', function (assert) {
	assert.plan(2);
	
	assert.throws(function () {
		_rawToPercent(-1);
	});
	
	assert.throws(function () {
		_rawToPercent(256);
	});
	
	assert.end();
});

test('_rawToPercent bad type', function (assert) {
	assert.plan(1);
	
	assert.throws(function () {
		_rawToPercent("129");
	});
	
	assert.end();
});

test('_rawToPercent table', function (assert) {
	// values from help document 'C-Bus to percent level lookup table'
	assert.plan(16);
	
	assert.equal(_rawToPercent(0), 0);
	assert.equal(_rawToPercent(1), 1);
	assert.equal(_rawToPercent(2), 1);
	assert.equal(_rawToPercent(3), 1);
	assert.equal(_rawToPercent(4), 2);
	assert.equal(_rawToPercent(5), 2);
	assert.equal(_rawToPercent(6), 3);
	
	assert.equal(_rawToPercent(43), 17);
	assert.equal(_rawToPercent(44), 18);
	assert.equal(_rawToPercent(128), 50);
	assert.equal(_rawToPercent(129), 51);
	
	assert.equal(_rawToPercent(250), 98);
	assert.equal(_rawToPercent(251), 99);
	assert.equal(_rawToPercent(252), 99);
	assert.equal(_rawToPercent(253), 100);
	assert.equal(_rawToPercent(255), 100);
	
	assert.end();
});