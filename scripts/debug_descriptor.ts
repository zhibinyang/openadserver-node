
// @ts-ignore
const protobuf = require('protobufjs');
require('protobufjs/ext/descriptor');

const protoDefinition = `
syntax = "proto3";

message AdEvent {
    string request_id = 1;
    string click_id = 2;
    int32 campaign_id = 3;
    int32 creative_id = 4;
    string user_id = 5;
    string device = 6;
    string browser = 7;
    int32 event_type = 8;
    int64 event_time = 9;
    double cost = 10;
    string ip = 11;
    string country = 12;
    string city = 13;
    double bid = 14;
    double price = 15;
}
`;

function debug() {
    console.log('--- Parsing Proto Definition ---');
    const root = protobuf.parse(protoDefinition, { keepCase: true }).root;
    const type = root.lookupType("AdEvent");

    console.log('--- Generating Descriptor ---');
    const descriptor = type.toDescriptor('proto3');

    console.log(JSON.stringify(descriptor, null, 2));
    if (descriptor.field && descriptor.field.length > 0) {
        console.log('Type of field[0].type:', typeof descriptor.field[0].type);
        console.log('Value of field[0].type:', descriptor.field[0].type);
    }
}

debug();
