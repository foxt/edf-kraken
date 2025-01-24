import { useSignal } from "@preact/signals";
import { Fragment, h, render } from "preact";
import { useEffect, useState } from "preact/hooks";
import { authState, currentAccessTokenData, login } from "./auth.ts";
import { getMeasurements, getViewerAccounts } from "./gql.ts";

const LoginPage = () => {
    let kraken = useSignal("api.edfgb-kraken.energy");
    let email = useSignal("");
    let password = useSignal("");
    return authState.value == "loading" ? "Loading..." : <div>
        {authState.value instanceof Error ? <div>{authState.value.message}</div> : null}
        <input type="text" placeholder="Kraken" value={kraken.value} onInput={(e) => kraken.value = e.currentTarget.value} />
        <input type="email" placeholder="Email" value={email.value} onInput={(e) => email.value = e.currentTarget.value} />
        <input type="password" placeholder="Password" value={password.value} onInput={(e) => password.value = e.currentTarget.value} />
        <button onClick={() => login(kraken.value, email.value, password.value)}>Login</button>
    </div>;
}

const currencyFormatter = new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
});
const dateFormatter = new Intl.DateTimeFormat('en-GB', {
    year: 'numeric', month: 'long', day: 'numeric'
});

const formatDate = (date: string | null) => date && dateFormatter.format(new Date(date));

const ViewAccount = ({ viewAccount, back }: { viewAccount: string, back: () => void }) => {
    let [usage, setUsage] = useState<Awaited<ReturnType<typeof getMeasurements>>>(null);    

    useEffect(() => {
        let now = new Date();
        let today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        let yesterday = new Date(today.getTime());
        yesterday.setDate(yesterday.getDate() - 2);
        getMeasurements({
            accountNumber: viewAccount,
            startAt: yesterday,
            endAt: today,
            first: 1000,
            utilityFilters: [
                { electricityFilters: {
                    readingFrequencyType: "RAW_INTERVAL"
                } },
                { gasFilters: {
                    readingFrequencyType: "RAW_INTERVAL"
                } }
                
            ],
        }).then(setUsage);
    }, [ viewAccount ]);
    console.log(usage);
    let maxValue = usage && usage.account.properties[0].measurements.edges.reduce((max, {node: m}) => Math.max(max, parseFloat(m.value)), 0);
    let maxCharge = usage && usage.account.properties[0].measurements.edges.reduce((max, {node: m}) => 
        Math.max(max, m.metaData.statistics
            .map(s => parseFloat(s.costInclTax?.estimatedAmount ?? "0"))
            .reduce((a, b) => a + b, 0)
        )
    , 0);
    return <>
        <a href="#" onClick={back}>Back to my accounts</a>
        <h1>Account {viewAccount} usage</h1>
        
        {/* @ts-ignore-next-line */}
        <table border="1">
            <thead>
                <tr>
                    <th>Time</th>
                    <th>Type</th>
                    <th>Usage</th>
                    <th>Charges</th>
                </tr>
            </thead>
            <tbody>
                {usage && usage.account.properties[0].measurements.edges.map(({node: m}) => {
                    let charges = m.metaData.statistics.map(s => parseFloat(s.costInclTax?.estimatedAmount ??"0"));
                    let chargeTotal = charges.reduce((a, b) => a + b, 0);
                    let utilityType = m.metaData.utilityFilters.__typename;
                    let colour = 
                        utilityType === "ElectricityFiltersOutput" ? "0,0,255" :
                        utilityType === "GasFiltersOutput" ? "255,0,0" :
                        "0,255,0";
                    return <tr key={m.startAt}>
                        <td>{m.startAt}</td>
                        <td>{
                            utilityType === "ElectricityFiltersOutput" ? "⚡️" :
                            utilityType === "GasFiltersOutput" ? "🔥" :
                            "❓"
                        }</td>
                        <td style={`background-color: rgba(${colour}, ${parseFloat(m.value) / maxValue})`}>
                            {parseFloat(m.value)}
                        </td>
                        <td style={`background-color: rgba(${colour}, ${chargeTotal / maxCharge})`}>
                            {charges.map(c => <>{c}p<br/></>)}
                        </td>
                    </tr>
                })}
            </tbody>
        </table>
    </>
};

const AccountView = () => {
    let [user, setUser] = useState<Awaited<ReturnType<typeof getViewerAccounts>>>(null);
    let [viewAccount, setViewAccount] = useState<string | null>(null);
    useEffect(() => {
        setUser(null);
        getViewerAccounts().then(setUser);
    }, [ currentAccessTokenData.value?.sub ]);
    return viewAccount ? <ViewAccount viewAccount={viewAccount} back={() => setViewAccount(null)} /> : user && <>
        <h1>Hello, {user.viewer.preferredName}</h1>
        <h2>Your accounts</h2>
        <ul>
            {user.viewer.accounts.map((a) => <li key={a.number}>
                <h3><a href="#" onClick={() => setViewAccount(a.number)}>{a.number}</a></h3>
                <p>Status: {a.status}</p>
                <p>Balance: {currencyFormatter.format(a.balance/100)}</p>
                <p>Address: {a.address.streetAddress}, {a.address.locality}, {a.address.postalCode}</p>
                <ul>{
                    a.properties.map((p) => <li key={p.address}>
                        <h4>{p.address}</h4>
                        Occupied: {p.occupancyPeriods.map((op) => `${formatDate(op.effectiveFrom)} - ${formatDate(op.effectiveTo) || "Present"}`).join(", ")}
                        <h5>Meter points</h5>
                        <ul>
                            {p.electricityMeterPoints.map((mp) => <li key={mp.id}>⚡️ {mp.id}</li>)}
                            {p.gasMeterPoints.map((mp) => <li key={mp.id}>🔥 {mp.id}</li>)}
                        </ul>
                    </li>)
                }</ul>
            </li>)}
        </ul>
    </>
}

const App = () => 
    authState.value == "ok" ? <AccountView/> : <LoginPage />;

render(<App />, document.body);