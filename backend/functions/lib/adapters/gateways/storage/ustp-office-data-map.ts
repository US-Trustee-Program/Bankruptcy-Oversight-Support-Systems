import { UstpOfficeDetails } from '../../../../../../common/src/cams/courts';

//TODO: We should probably put this in Cosmos so we don't have to deal with this locally
export const USTP_OFFICE_DATA_MAP = new Map<string, UstpOfficeDetails>([
  [
    'USTP_CAMS_Region_18_Office_Seattle',
    {
      officeCode: 'USTP_CAMS_Region_18_Office_Seattle',
      idpGroupId: 'USTP CAMS Region 18 Office Seattle',
      officeName: 'Seattle',
      groups: [
        {
          groupDesignator: 'SE',
          divisions: [
            {
              divisionCode: '812',
              court: { courtId: '0981', courtName: 'Western District of Washington' },
              courtOffice: {
                courtOfficeCode: '2',
                courtOfficeName: 'Seattle',
              },
            },
            {
              divisionCode: '813',
              court: { courtId: '0981', courtName: 'Western District of Washington' },
              courtOffice: {
                courtOfficeCode: '3',
                courtOfficeName: 'Tacoma',
              },
            },
          ],
        },
        {
          groupDesignator: 'AK',
          divisions: [
            {
              divisionCode: '710',
              court: { courtId: '097-', courtName: 'District of Alaska' },
              courtOffice: {
                courtOfficeCode: '1',
                courtOfficeName: 'Juneau',
              },
            },
            {
              divisionCode: '720',
              court: { courtId: '097-', courtName: 'District of Alaska' },
              courtOffice: {
                courtOfficeCode: '2',
                courtOfficeName: 'Nome',
              },
            },
            {
              divisionCode: '730',
              court: { courtId: '097-', courtName: 'District of Alaska' },
              courtOffice: {
                courtOfficeCode: '3',
                courtOfficeName: 'Anchorage',
              },
            },
            {
              divisionCode: '740',
              court: { courtId: '097-', courtName: 'District of Alaska' },
              courtOffice: {
                courtOfficeCode: '4',
                courtOfficeName: 'Fairbanks',
              },
            },
            {
              divisionCode: '750',
              court: { courtId: '097-', courtName: 'District of Alaska' },
              courtOffice: {
                courtOfficeCode: '5',
                courtOfficeName: 'Ketchikan',
              },
            },
          ],
        },
      ],
      regionId: '18',
      regionName: 'Seattle',
    },
  ],
  [
    'USTP_CAMS_Region_2_Office_Manhattan',
    {
      officeCode: 'USTP_CAMS_Region_2_Office_Manhattan',
      idpGroupId: 'USTP CAMS Region 2 Office Manhattan',
      officeName: 'Manhattan',
      groups: [
        {
          groupDesignator: 'NY',
          divisions: [
            {
              divisionCode: '081',
              court: { courtId: '0208', courtName: 'Southern District of New York' },
              courtOffice: {
                courtOfficeCode: '1',
                courtOfficeName: 'Manhattan',
              },
            },
            {
              divisionCode: '087',
              court: { courtId: '0208', courtName: 'Southern District of New York' },
              courtOffice: {
                courtOfficeCode: '7',
                courtOfficeName: 'White Plains',
              },
            },
          ],
        },
      ],
      regionId: '2',
      regionName: 'New York',
    },
  ],
]);
