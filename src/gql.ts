import { getAuthToken, KrakenJwtPayload } from "./auth.ts";

async function doGql<R>(url: string | undefined, _token: Promise<{ token: string, onSuccess: () => void }> | undefined, request: any) {
    let token = await _token;
    let headers = {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `JWT ${token.token}` } : {})
    } as any;
    if (!url) {
        if (!token) throw new Error("No token or URL provided");
        let payload = JSON.parse(atob(token.token.split('.')[1])) as KrakenJwtPayload;
        url = payload.iss;
    }
    let response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(request)
    });
    let data = await response.json();
    if (data.errors) 
        throw new Error(
            data.errors
                .map((e: any) => `${e.extensions?.errorType} (${e.extensions?.errorCode}): ${e.path?.join(".")} ${e.message} (${e.extensions?.errorDescription})`)
                .join('\n')
        )
    token?.onSuccess();
    
    return data.data as R;
}

export type ObtainJSONWebTokenInput = 
    { APIKey: string } |
    { email: string, password: string } |
    { refreshToken: string } |
    { organizationSecretKey: string } |
    { preSignedKey: string };
export const obtainKrakenToken = (url: string, data: ObtainJSONWebTokenInput) => 
    doGql<{
        obtainKrakenToken: {
            token:            string;
            payload:          KrakenJwtPayload;
            refreshToken:     string;
            refreshExpiresIn: number;
            __typename:       string;
        };
    }>(
        url, undefined, 
            {
                "operationName":"obtainKrakenToken",
                "query":"mutation obtainKrakenToken($input: ObtainJSONWebTokenInput!) {\n  obtainKrakenToken(input: $input) {\n    token\n    payload\n    refreshToken\n    refreshExpiresIn\n    __typename\n  }\n}", 
                "variables":{ "input": data }
            }
    )

export interface AccountUserType {
    // accountUserRoles?: AccountUserRoleType[];
    accounts: AccountType[];
    preferredName: string;
    email:         string;
    __typename:    "AccountUserType";
}

export interface AccountType {
    number:      string;
    status:      string;
    accountType: string;
    balance:     number;
    address:     RichAddressType;
    properties:  PropertyType[];
    __typename:  "AccountType";
}

export interface RichAddressType {
    streetAddress: string;
    locality:      string;
    postalCode:    string;
    __typename:    "RichAddressType";
}

export interface PropertyType {
    address:                string;
    occupancyPeriods:       OccupancyPeriodType[];
    electricityMeterPoints: MeterPoint[];
    gasMeterPoints:         MeterPoint[];
    __typename:             "PropertyType";
}

export interface MeterPoint {
    id:         string;
    __typename: string;
}

export interface OccupancyPeriodType {
    effectiveFrom: string;
    effectiveTo:   string | null;
    __typename:    "OccupancyPeriodType";
}
export const getViewerAccounts = () => 
    doGql<{ viewer: AccountUserType }>(
        undefined, getAuthToken(), 
        {"operationName":"getViewerAccounts","variables":{},"query":"query getViewerAccounts($propertiesActiveFrom: DateTime) {\n  viewer {\n    preferredName\n    email\n    accounts {\n      number\n      status\n      accountType\n      balance\n      address {\n        streetAddress\n        locality\n        postalCode\n        __typename\n      }\n      ... on AccountType {\n        properties(activeFrom: $propertiesActiveFrom) {\n          address\n          occupancyPeriods {\n            effectiveFrom\n            effectiveTo\n            __typename\n          }\n          electricityMeterPoints {\n            id\n            __typename\n          }\n          gasMeterPoints {\n            id\n            __typename\n          }\n          __typename\n        }\n        __typename\n      }\n      __typename\n    }\n    __typename\n  }\n}"}
    )

type ReadingFrequencyType = "DAILY" | "DAY_INTERVAL" | "FIFTEEN_MIN_INTERVAL" | "FIVE_MIN_INTEVAL" | "HOUR_INTERVAL" | "MONTH_INTERVAL" | "POINT_IN_TIME" | "QUARTER_INTERVAL" | "RAW_INTERVAL" | "THIRTY_MIN_INTERVAL";
type ReadingDirectionType = "CONSUMPTION" | "GENERATION";
type ReadingQualityType = "ACTUAL" | "COMBINED" | "ESTIMATE";

interface ElectricityFiltersInput {
    deviceId?: string;
    marketSupplyPointId?: string;
    readingDirection?: ReadingDirectionType;
    readingFrequencyType?: ReadingFrequencyType;
    readingQuality?: ReadingQualityType;
    registerId?: string;

}

interface GasFiltersInput {
    deviceId?: string;
    marketSupplyPointId?: string;
    readingFrequencyType?: ReadingFrequencyType;
    registerId?: string;
}

interface UtilityFiltersInput {
    electricityFilters?: ElectricityFiltersInput,
    gasFilters?: GasFiltersInput
}


export interface IntervalMeasurementType {
    value:      string;
    startAt:    string;
    metaData:   MeasurementsMetadataOutput;
    __typename: "IntervalMeasurementType";
}

export interface MeasurementsMetadataOutput {
    statistics:     StatisticOutput[];
    __typename:     "MeasurementsMetadataOutput";
    utilityFilters: {
        __typename:  "ElectricityFiltersOutput" | "GasFiltersOutput";
    };
}

export interface StatisticOutput {
    costInclTax: EstimatedMoneyType;
    __typename:  "StatisticOutput";
}

export interface EstimatedMoneyType {
    estimatedAmount: string;
    __typename:      "EstimatedMoneyType";
}


export interface IntervalMeasurementType {
    value:      string;
    startAt:    Date;
    metaData:   MeasurementsMetadataOutput;
    __typename: "IntervalMeasurementType";
}

export interface MeasurementsMetadataOutput {
    statistics:     StatisticOutput[];
    __typename:     "MeasurementsMetadataOutput";
    utilityFilters: {
        __typename:  "ElectricityFiltersOutput" | "GasFiltersOutput";
    };
}

export interface StatisticOutput {
    costInclTax: EstimatedMoneyType;
    __typename:  "StatisticOutput";
}

export interface EstimatedMoneyType {
    estimatedAmount: string;
    __typename:      "EstimatedMoneyType";
}



export const getMeasurements = (query: {
    accountNumber: string,
    first: number,
    utilityFilters: UtilityFiltersInput[],
    startAt?: Date,
    endAt?: Date
    timezone?: string
    cursor?: string
}) => 
    doGql<{
        account: {
            properties: {
                measurements: {
                    edges: {
                        node: IntervalMeasurementType
                    }[];
                };
            }[];
        }
    }
    
    >(undefined, getAuthToken(),{
            "operationName":"getMeasurements",
            "query":"query getMeasurements($accountNumber: String!, $first: Int!, $utilityFilters: [UtilityFiltersInput!], $startAt: DateTime, $endAt: DateTime) {\n  account(accountNumber: $accountNumber) {\n    properties {\n      measurements(\n        first: $first\n        utilityFilters: $utilityFilters\n        startAt: $startAt\n        endAt: $endAt\n      ) {\n        edges {\n          node {\n            value\n            ... on MeasurementType {\n              source\n              value\n              unit\n              readAt\n              metaData {\n                statistics {\n                  type\n                  label\n                  description\n                  costExclTax {\n                    estimatedAmount\n                    costCurrency\n                    __typename\n                  }\n                  costInclTax {\n                    estimatedAmount\n                    costCurrency\n                    __typename\n                  }\n                  value\n                  __typename\n                }\n                utilityFilters {\n                  __typename\n                }\n                __typename\n              }\n              __typename\n            }\n            ... on IntervalMeasurementType {\n              startAt\n              value\n              metaData {\n                statistics {\n                  costInclTax {\n                    estimatedAmount\n                    __typename\n                  }\n                  __typename\n                }\n                __typename\n              }\n              __typename\n            }\n            metaData {\n              utilityFilters {\n                __typename\n              }\n              __typename\n            }\n            __typename\n          }\n          __typename\n        }\n        __typename\n      }\n      __typename\n    }\n    __typename\n  }\n}", 
            "variables":query
    })
