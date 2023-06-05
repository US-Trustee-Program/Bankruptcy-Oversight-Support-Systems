// import {Context} from "./types/basic";
// import {PacerGatewayInterface} from "../use-cases/pacer.gateway.interface";
// import config from "../configs";
// import log from "./services/logger.service";
//
// const NAMESPACE = 'DATA-ACCESS-PROXY';
//
//
// async function proxyPacer(context: Context): Promise<PacerGatewayInterface> {
//     if (config.get('pacerMock')) {
//         log.info(context, NAMESPACE, 'using local PACER data');
//         return await import(`./gateways/local.pacer.gateway`);
//     } else {
//         log.info(context, NAMESPACE, 'using PACER API');
//         return await import(`./gateways/pacer.gateway`);
//     }
// }
//
// export default proxyPacer;
