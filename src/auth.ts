import { computed, signal } from "@preact/signals";
import { ObtainJSONWebTokenInput, obtainKrakenToken } from "./gql.ts";

export type KrakenJwtPayload = {
    "sub": `kraken|${string}`,
    "gty": "EMAIL-AND-PASSWORD",
    "email": string,
    "tokenUse": "access",
    "iss": "https://api.edfgb-kraken.energy/v1/graphql/" | ({} & string)
    "iat": number,
    "exp": number,
    "origIat": number
}
export const authState = signal<"ok" | Error | "loading">("ok");


let currentAccessToken = signal<null | string>(localStorage.getItem('authToken') || null);
export let currentAccessTokenData = computed(() => {
    let authToken = currentAccessToken.value;
    if (!authToken) return null;
    try {
        return JSON.parse(atob(authToken.split('.')[1])) as KrakenJwtPayload;
    } catch(e) {
        console.log(e);
        return null;
    }
})

function checkAuthorised() {
    try {
        if (localStorage.getItem('authToken') !== currentAccessToken.value)
            currentAccessToken.value = localStorage.getItem('authToken');
        
        let tknData = currentAccessTokenData.value;
        let now = Date.now() / 1000;
        if (!tknData) throw new Error("Access token missing or invalid");
        let isExpired = tknData.exp < now;
        if (isExpired) throw new Error("Access token expired");
        console.log("Access token valid");
        return true;
    } catch(e) {
        localStorage.removeItem('authToken');
        currentAccessToken.value = null;
        throw e;
    }
}

export async function getAuthToken() {
    console.log("Get auth");
    try {
        while (authState.value !== "ok") {
            let l;
            await new Promise((a) => l = authState.subscribe((v) => {
                if (v === "ok") a(v);
            }));
            l();
        }
        checkAuthorised();
    } catch(e) {
        console.log(e);
        
        let refreshData;
        try {
            let data  = JSON.parse(localStorage.getItem('refreshData'));
            if (data.expires > Date.now() / 1000) 
                refreshData = data;
        } catch(e) { console.log("Can't refresh because", e)}
        if (refreshData) {
            let { token, url } = refreshData;
            await login(url, { refreshToken: token });
        } else { 
            if (authState.value !== "loading")
                authState.value = e;
        }
        return getAuthToken();
        
    
    }
    return { token: currentAccessToken.value, onSuccess: () => authState.value = 'ok' };
}
currentAccessToken.subscribe(getAuthToken);
getAuthToken();

export async function login(url: string, data: ObtainJSONWebTokenInput) {
    authState.value = "loading";
    try {
        let {obtainKrakenToken: tkn} = await obtainKrakenToken(url, data);
        
        localStorage.setItem('authToken', tkn.token);
        localStorage.setItem('refreshData', JSON.stringify({
            token: tkn.refreshToken,
            expires: tkn.refreshExpiresIn,
            url
        }))
        currentAccessToken.value = tkn.token;
        authState.value = "ok";
        return true;
    } catch(e) {
        authState.value = e as Error;
        return false;
    } 
}



