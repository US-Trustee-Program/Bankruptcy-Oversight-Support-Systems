import { Mock } from './mock-data';

console.log(JSON.stringify(Mock.getTransferOrder('person'), null, 2));
console.log(JSON.stringify(Mock.getTransferOrder('company'), null, 2));

console.log(JSON.stringify(Mock.getTransferOrder('company', { status: 'approved' }), null, 2));
console.log(JSON.stringify(Mock.getTransferOrder('company', { status: 'rejected' }), null, 2));
