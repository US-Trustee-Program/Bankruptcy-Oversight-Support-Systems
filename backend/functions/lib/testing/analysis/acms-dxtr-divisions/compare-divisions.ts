import { InvocationContext } from '@azure/functions';
import applicationContextCreator from '../../../../azure/application-context-creator';
import { LoggerImpl } from '../../../adapters/services/logger.service';
import OfficesDxtrGateway from '../../../adapters/gateways/dxtr/offices.dxtr.gateway';
import { UstpOfficeDetails } from '../../../../../../common/src/cams/offices';
import * as fs from 'fs/promises';

// Sourced from Office_Regions_and_Divisions.pdf
const csv = `acmsRegion,acmsGroup,acmsJudicialDistrictName,acmsDivisionCode,acmsDivisionName
01,BO,District of Massachusetts,011,Boston
01,MR,District of New Hampshire,021,Manchester
01,PO,District of Maine,001,Bangor
01,PO,District of Maine,002,Portland
01,PR,District of Rhode Island,031,Providence
01,WO,District of Massachusetts,014,Worcester
02,AL,District of Vermont,105,Rutland
02,AL,Northern District of New York,061,Albany
02,AL,Southern District of New York,084,Poughkeepsie
02,BR,Eastern District of New York,071,Brooklyn
02,BU,Western District of New York,091,Buffalo
02,LI,Eastern District of New York,070,Central Islip
02,LI,Eastern District of New York,078,Central Islip
02,NH,District of Connecticut,052,Hartford
02,NH,District of Connecticut,053,New Haven
02,NH,District of Connecticut,055,Bridgeport
02,NY,Southern District of New York,081,New York
02,NY,Southern District of New York,087,White Plains
02,RO,Western District of New York,096,Rochester
02,UT,Northern District of New York,065,Syracuse
02,UT,Northern District of New York,066,Utica
03,HA,Middle District of Pennsylvania,141,Harrisburg
03,HA,Middle District of Pennsylvania,144,Williamsport
03,HA,Middle District of Pennsylvania,145,Wilkes-Barre
03,NE,District of New Jersey,121,Camden
03,NE,District of New Jersey,122,Newark
03,NE,District of New Jersey,123,Trenton
03,NE,District of New Jersey,129,Atlantic City
03,PH,Eastern District of Pennsylvania,132,Philadelphia
03,PH,Eastern District of Pennsylvania,134,Reading
03,PI,Western District of Pennsylvania,151,Erie
03,PI,Western District of Pennsylvania,152,Pittsburgh
03,PI,Western District of Pennsylvania,157,Johnstown
03,WL,District of Delaware,111,Wilmington
04,AX,District of Columbia,900,District of Columbia
04,AX,Eastern District of Virginia,221,Alexandria
04,BA,District of Maryland,161,Baltimore
04,CO,District of South Carolina,203,Columbia
04,CT,Northern District of West Virginia,241,Clarksburg
04,CT,Northern District of West Virginia,242,Elkins
04,CT,Northern District of West Virginia,243,Martinsburg
04,CT,Northern District of West Virginia,245,Wheeling
04,CT,Southern District of West Virginia,250,Parkersburg
04,CT,Southern District of West Virginia,251,Bluefield
04,CT,Southern District of West Virginia,252,Charleston
04,CT,Southern District of West Virginia,253,Huntington
04,CT,Southern District of West Virginia,255,Beckley
04,NO,Eastern District of Virginia,222,Norfolk
04,NO,Eastern District of Virginia,224,Newport News
04,RH,Eastern District of Virginia,223,Richmond
04,RK,District of Maryland,160,Greenbelt
04,RN,Western District of Virginia,235,Harrisonburg
04,RN,Western District of Virginia,236,Lynchburg
04,RN,Western District of Virginia,237,Roanoke
05,JA,Northern District of Mississippi,371,Aberdeen
05,JA,Southern District of Mississippi,381,Gulfport
05,JA,Southern District of Mississippi,383,Jackson
05,NR,Eastern District of Louisiana,302,New Orleans
05,NR,Middle District of Louisiana,313,New Orleans
05,SH,Western District of Louisiana,361,Alexandria
05,SH,Western District of Louisiana,362,Lake Charles
05,SH,Western District of Louisiana,363,Monroe
05,SH,Western District of Louisiana,364,Lafayette
05,SH,Western District of Louisiana,365,Shreveport
06,DA,Northern District of Texas,391,Abilene
06,DA,Northern District of Texas,392,Amarillo
06,DA,Northern District of Texas,393,Dallas
06,DA,Northern District of Texas,394,Fort Worth
06,DA,Northern District of Texas,395,Lubbock
06,DA,Northern District of Texas,396,San Angelo
06,DA,Northern District of Texas,397,Wichita Falls
06,TY,Eastern District of Texas,401,Beaumont
06,TY,Eastern District of Texas,402,Marshall
06,TY,Eastern District of Texas,403,Paris
06,TY,Eastern District of Texas,404,Sherman
06,TY,Eastern District of Texas,405,Texarkana
06,TY,Eastern District of Texas,406,Tyler
06,TY,Eastern District of Texas,409,Lufkin
07,AU,Western District of Texas,421,Austin
07,AU,Western District of Texas,426,Waco
07,CC,Southern District of Texas,411,Brownsville
07,CC,Southern District of Texas,412,Corpus Christi
07,CC,Southern District of Texas,417,McAllen
07,HU,Southern District of Texas,413,Galveston
07,HU,Southern District of Texas,414,Houston
07,HU,Southern District of Texas,415,Laredo
07,HU,Southern District of Texas,416,Victoria
07,SN,Western District of Texas,423,El Paso
07,SN,Western District of Texas,425,San Antonio
07,SN,Western District of Texas,427,Midland-Odessa
08,CN,Eastern District of Tennessee,491,Chattanooga
08,CN,Eastern District of Tennessee,492,Greeneville
08,CN,Eastern District of Tennessee,493,Knoxville
08,LO,Western District of Kentucky,441,Bowling Green
08,LO,Western District of Kentucky,443,Louisville
08,LO,Western District of Kentucky,444,Owensboro
08,LO,Western District of Kentucky,445,Paducah
08,LX,Eastern District of Kentucky,431,Ashland
08,LX,Eastern District of Kentucky,432,Covington
09,CB,Southern District of Ohio,482,Columbus
09,CB,Southern District of Ohio,483,Dayton
09,CI,Southern District of Ohio,481,Cincinnati
09,CL,Northern District of Ohio,471,Cleveland
09,CL,Northern District of Ohio,473,Toledo
09,CL,Northern District of Ohio,474,Youngstown
09,CL,Northern District of Ohio,475,Akron
09,CL,Northern District of Ohio,476,Canton
09,DE,Eastern District of Michigan,451,Bay City
09,DE,Eastern District of Michigan,452,Detroit
09,DE,Eastern District of Michigan,454,Flint
09,GR,Western District of Michigan,461,Grand Rapids
09,GR,Western District of Michigan,462,Marquette
10,IN,Southern District of Indiana,561,Indianapolis
10,IN,Southern District of Indiana,562,Terre Haute
10,IN,Southern District of Indiana,563,Evansville
10,IN,Southern District of Indiana,564,New Albany
10,PE,Central District of Illinois,531,Peoria
10,PE,Central District of Illinois,532,Danville
10,PE,Central District of Illinois,533,Springfield
10,PE,Southern District of Illinois,543,East Saint Louis
10,PE,Southern District of Illinois,544,Benton
10,PE,Southern District of Illinois,545,Alton
10,PE,Southern District of Illinois,546,Effingham
10,SO,Northern District of Indiana,551,Fort Wayne
10,SO,Northern District of Indiana,553,South Bend
10,SO,Northern District of Indiana,554,Lafayette
10,SO,Northern District of Indiana,556,Hammond
11,CH,Northern District of Illinois,521,Chicago
11,MD,Northern District of Illinois,523,Rockford
11,MD,Western District of Wisconsin,581,Eau Claire
11,MD,Western District of Wisconsin,582,La Crosse
11,MD,Western District of Wisconsin,583,Madison
11,MD,Western District of Wisconsin,585,Wausau
11,MI,Eastern District of Wisconsin,572,Milwaukee
12,CR,Northern District of Iowa,621,Cedar Rapids
12,CR,Northern District of Iowa,622,Dubuque
12,CR,Northern District of Iowa,623,Fort Dodge
12,CR,Northern District of Iowa,624,Mason City
12,CR,Northern District of Iowa,625,Sioux City
12,CR,Northern District of Iowa,626,Waterloo
12,DM,Southern District of Iowa,631,Council Bluffs
12,DM,Southern District of Iowa,633,Davenport
12,DM,Southern District of Iowa,634,Des Moines
12,MN,District of Minnesota,643,St. Paul
12,MN,District of Minnesota,644,Minneapolis
12,MN,District of Minnesota,645,Duluth
12,MN,District of Minnesota,646,Fergus Falls
12,SX,District of North Dakota,683,Fargo
12,SX,District of South Dakota,691,Aberdeen
12,SX,District of South Dakota,693,Pierre
12,SX,District of South Dakota,694,Sioux Falls
12,SX,District of South Dakota,695,Rapid City
13,KC,Western District of Missouri,662,Jefferson City
13,KC,Western District of Missouri,663,Joplin
13,KC,Western District of Missouri,664,Kansas City
13,KC,Western District of Missouri,665,St. Joseph
13,KC,Western District of Missouri,666,Springfield
13,LR,Eastern District of Arkansas,601,Batesville
13,LR,Eastern District of Arkansas,602,Helena
13,LR,Eastern District of Arkansas,603,Jonesboro
13,LR,Eastern District of Arkansas,604,Little Rock
13,LR,Eastern District of Arkansas,605,Pine Bluff
13,LR,Western District of Arkansas,611,El Dorado
13,LR,Western District of Arkansas,612,Fort Smith
13,LR,Western District of Arkansas,613,Harrison
13,LR,Western District of Arkansas,614,Texarkana
13,LR,Western District of Arkansas,615,Fayetteville
13,LR,Western District of Arkansas,616,Hot Springs
13,OM,District of Nebraska,674,Lincoln
13,OM,District of Nebraska,678,Omaha
13,SL,Eastern District of Missouri,651,Cape Girardeau
13,SL,Eastern District of Missouri,652,Hannibal
13,SL,Eastern District of Missouri,654,St. Louis
14,PX,District of Arizona,700,Yuma
14,PX,District of Arizona,702,Phoenix
14,PX,District of Arizona,703,Prescott
14,PX,District of Arizona,704,Tucson
15,HI,District of Guam,931,Guam
15,HI,District of Hawaii,751,Honolulu
15,HI,Northern Mariana Islands,941,Saipan
15,SD,Southern District of California,743,San Diego
16,LA,Central District of California,732,Los Angeles
16,SA,Central District of California,738,Santa Ana
16,SB,Central District of California,736,Riverside
16,WH,Central District of California,731,Woodland Hills
16,WH,Central District of California,739,Santa Barbara
17,FR,Eastern District of California,721,Fresno
17,LV,District of Nevada,782,Las Vegas
17,OA,Northern District of California,714,Oakland
17,RE,District of Nevada,783,Reno
17,SC,Eastern District of California,722,Sacramento
17,SC,Eastern District of California,729,Modesto
17,SF,Northern District of California,711,Santa Rosa
17,SF,Northern District of California,713,San Francisco
17,SJ,Northern District of California,715,San Jose
18,AK,District of Alaska,710,Juneau
18,AK,District of Alaska,720,Nome
18,AK,District of Alaska,730,Anchorage
18,AK,District of Alaska,740,Fairbanks
18,AK,District of Alaska,750,Ketchikan
18,BS,District of Idaho,761,Boise
18,BS,District of Idaho,762,Coeur d'Alene
18,BS,District of Idaho,763,Moscow
18,BS,District of Idaho,764,Pocatello
18,BS,District of Idaho,768,Twin Falls
18,EG,District of Oregon,796,Eugene
18,GF,District of Montana,772,Butte
18,PL,District of Oregon,793,Portland
18,SE,Western District of Washington,812,Seattle
18,SE,Western District of Washington,813,Tacoma
18,SP,Eastern District of Washington,801,Yakima
18,SP,Eastern District of Washington,802,Spokane
19,CY,District of Wyoming,891,Cheyenne
19,CY,District of Wyoming,892,Cheyenne
19,DV,District of Colorado,821,Denver
19,SK,District of Utah,882,Salt Lake City
19,SK,District of Utah,884,St. George
20,AQ,District of New Mexico,841,Albuquerque
20,OC,Western District of Oklahoma,875,Oklahoma City
20,TU,Eastern District of Oklahoma,867,Okmulgee
20,TU,Northern District of Oklahoma,854,Tulsa
20,WI,District of Kansas,832,Kansas City
20,WI,District of Kansas,835,Topeka
20,WI,District of Kansas,836,Wichita
21,AT,Northern District of Georgia,321,Atlanta
21,AT,Northern District of Georgia,322,Gainesville
21,AT,Northern District of Georgia,323,Newnan
21,AT,Northern District of Georgia,324,Rome
21,AT,Virgin Islands (St. Croix),911,Virgin Islands (St. Croix)
21,AT,Virgin Islands (St. Thomas),913,Virgin Islands (St. Thomas)
21,HR,District of Puerto Rico,042,Ponce
21,HR,District of Puerto Rico,043,San Juan
21,MC,Middle District of Georgia,331,Albany
21,MC,Middle District of Georgia,332,Americus
21,MC,Middle District of Georgia,333,Athens
21,MC,Middle District of Georgia,334,Columbus
21,MC,Middle District of Georgia,335,Macon
21,MC,Middle District of Georgia,336,Thomasville
21,MC,Middle District of Georgia,337,Valdosta
21,MM,Southern District of Florida,310,Broward County
21,MM,Southern District of Florida,311,Dade County
21,MM,Southern District of Florida,312,Palm Beach County
21,MM,Southern District of Florida,319,Palm Beach County
21,OR,Middle District of Florida,303,Jacksonville
21,OR,Middle District of Florida,306,Orlando
21,SV,Southern District of Georgia,341,Augusta
21,SV,Southern District of Georgia,342,Brunswick
21,SV,Southern District of Georgia,343,Dublin
21,SV,Southern District of Georgia,344,Savannah
21,SV,Southern District of Georgia,345,Waycross
21,SV,Southern District of Georgia,346,Statesboro
21,TL,Northern District of Florida,291,Gainesville
21,TL,Northern District of Florida,293,Pensacola
21,TL,Northern District of Florida,294,Tallahassee
21,TL,Northern District of Florida,295,Panama City
21,TP,Middle District of Florida,308,Tampa`;

type AcmsRegionDivision = {
  acmsRegion: string;
  acmsGroup: string;
  acmsJudicialDistrictName: string;
  acmsDivisionCode: string;
  acmsDivisionName: string;
};

type DxtrRegionDivision = {
  dxtrRegion: string;
  dxtrRegionName: string;
  dxtrGroup: string;
  dxtrJudicialDistrictName: string;
  dxtrDivisionCode: string;
  dxtrDivisionName: string;
  oktaGroupName: string;
  camsOfficeCode: string;
  ustpOfficeName: string;
};

type DivisionMatch = { acms: AcmsRegionDivision; dxtr: DxtrRegionDivision };
type JoinedDivisions = AcmsRegionDivision & DxtrRegionDivision;

type Output = {
  match: DivisionMatch[];
  noMatch: DivisionMatch[];
  ignored: DivisionMatch[];
};

function loadAcmsRegionDivisions() {
  const records = csv.split('\n');
  const header = records.shift();
  const keys = header.split(',') as (keyof AcmsRegionDivision)[];
  const divisions = records.map((record) => {
    const obj = {};
    const values = record.split(',');
    keys.forEach((key, idx) => {
      obj[key] = values[idx];
    });
    return obj as AcmsRegionDivision;
  });
  return divisions;
}

export function ustpOfficeToDivision(ustp: UstpOfficeDetails): DxtrRegionDivision[] {
  const courtDivisions: DxtrRegionDivision[] = [];
  ustp.groups.reduce((acc, group) => {
    group.divisions.forEach((division) => {
      acc.push({
        dxtrRegion: ustp.regionId,
        dxtrRegionName: ustp.regionName,
        dxtrGroup: group.groupDesignator,
        dxtrJudicialDistrictName: division.court.courtName,
        dxtrDivisionCode: division.divisionCode,
        dxtrDivisionName: division.courtOffice.courtOfficeName,
        oktaGroupName: ustp.idpGroupId,
        camsOfficeCode: ustp.officeCode,
        ustpOfficeName: ustp.officeName,
      });
    });
    return acc;
  }, courtDivisions);
  return courtDivisions;
}

async function writeToCsv(records: JoinedDivisions[], fileName: string) {
  if (records.length === 0) return;

  const outputDirectory = './temp/acms-dxtr-divisions';
  await fs.mkdir(outputDirectory, { recursive: true });
  const file = await fs.open(`${outputDirectory}/${fileName}`, 'w');

  file.write(Object.keys(records[0]).join(',') + '\n');

  records.forEach((record) => {
    const values: string[] = [];
    Object.keys(record).forEach((key) => values.push(record[key]));
    values.forEach((value, idx) => {
      if (value.includes(',')) values[idx] = '"' + value + '"';
    });
    file.write(values.join(',') + '\n');
  });
  file.close();
}

function joinMatchedRecord(match: DivisionMatch) {
  const record: JoinedDivisions = {
    acmsRegion: '',
    acmsGroup: '',
    acmsJudicialDistrictName: '',
    acmsDivisionCode: '',
    acmsDivisionName: '',
    dxtrRegion: '',
    dxtrRegionName: '',
    dxtrGroup: '',
    dxtrJudicialDistrictName: '',
    dxtrDivisionCode: '',
    dxtrDivisionName: '',
    oktaGroupName: '',
    camsOfficeCode: '',
    ustpOfficeName: '',
    ...match.acms,
    ...match.dxtr,
  };
  return record;
}

async function outputResults(results: Output) {
  await writeToCsv(results.match.map(joinMatchedRecord), 'acms_dxtr_match.csv');
  await writeToCsv(results.noMatch.map(joinMatchedRecord), 'acms_dxtr_nomatch.csv');
  await writeToCsv(results.ignored.map(joinMatchedRecord), 'acms_dxtr_ignored.csv');
}

async function main() {
  // Instantiate offices gateway.
  const context = await applicationContextCreator.getApplicationContext({
    invocationContext: new InvocationContext(),
    logger: new LoggerImpl('analysis'),
  });
  const gateway = new OfficesDxtrGateway();
  const ustpOffices = await gateway.getOffices(context);

  // Get acms and dxtr division records.
  const dxtrDivisions = ustpOffices.reduce((acc, office) => {
    acc.push(...ustpOfficeToDivision(office));
    return acc;
  }, [] as DxtrRegionDivision[]);
  const acmsDivisions = loadAcmsRegionDivisions();

  // Get the set of unique division codes between acms and dxtr.
  const uniqueDivisionCodes = new Set<string>();
  acmsDivisions.forEach((division) => uniqueDivisionCodes.add(division.acmsDivisionCode));
  dxtrDivisions.forEach((division) => uniqueDivisionCodes.add(division.dxtrDivisionCode));

  // Match acms and dxtr records by division code.
  const map = Array.from(uniqueDivisionCodes).reduce((acc, divisionCode) => {
    const mapping: DivisionMatch = {
      acms: acmsDivisions.find((division) => division.acmsDivisionCode === divisionCode),
      dxtr: dxtrDivisions.find((division) => division.dxtrDivisionCode === divisionCode),
    };
    acc.set(divisionCode, mapping);
    return acc;
  }, new Map<string, DivisionMatch>());

  // Classify matches, non-matches and ignored records.
  const output = Array.from(uniqueDivisionCodes).reduce(
    (acc, divisionCode) => {
      const mapping = map.get(divisionCode);

      // Ignore any known, bad DXTR records.
      if (mapping.dxtr?.dxtrRegion === '99') {
        acc.ignored.push(mapping);
        return acc;
      }

      // Find mismatches on division code.
      if (!mapping.acms || !mapping.dxtr) {
        acc.noMatch.push(mapping);
        return acc;
      }

      // Group records matched on division code.
      acc.match.push(mapping);
      return acc;
    },
    { match: [], noMatch: [], ignored: [] } as Output,
  );

  // Write the results to the temp directory.
  // See: backend/functions/temp/
  await outputResults(output);
}

(async () => {
  await main();
})();
