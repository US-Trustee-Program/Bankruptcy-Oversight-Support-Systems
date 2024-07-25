# CAMS Webapp with Functions API

```mermaid
graph TB
  linkStyle default fill:#ffffff

  subgraph diagram ["CAMS - API - Components"]
    style diagram fill:#ffffff,stroke:#ffffff

    8("<div style='font-weight: bold'>Webapp</div><div style='font-size: 70%; margin-top: 0px'>[Container]</div><div style='font-size: 80%; margin-top:10px'>The user interface for CAMS</div>")
    style 8 fill:#438dd5,stroke:#2e6295,color:#ffffff
    26("<div style='font-weight: bold'>DXTR DB</div><div style='font-size: 70%; margin-top: 0px'>[Container]</div><div style='font-size: 80%; margin-top:10px'>DXTR SQL Database</div>")
    style 26 fill:#438dd5,stroke:#2e6295,color:#ffffff
    27("<div style='font-weight: bold'>Cosmos DB</div><div style='font-size: 70%; margin-top: 0px'>[Container]</div><div style='font-size: 80%; margin-top:10px'>NoSQL Database</div>")
    style 27 fill:#438dd5,stroke:#2e6295,color:#ffffff

    subgraph 12 [API]
      style 12 fill:#ffffff,stroke:#2e6295,color:#2e6295

      13("<div style='font-weight: bold'>Attorneys</div><div style='font-size: 70%; margin-top: 0px'>[Component]</div><div style='font-size: 80%; margin-top:10px'>Attorneys API</div>")
      style 13 fill:#85bbf0,stroke:#5d82a8,color:#000000
      14("<div style='font-weight: bold'>Cases</div><div style='font-size: 70%; margin-top: 0px'>[Component]</div><div style='font-size: 80%; margin-top:10px'>Cases API</div>")
      style 14 fill:#85bbf0,stroke:#5d82a8,color:#000000
      15("<div style='font-weight: bold'>Assignments</div><div style='font-size: 70%; margin-top: 0px'>[Component]</div><div style='font-size: 80%; margin-top:10px'>Case Assignments API</div>")
      style 15 fill:#85bbf0,stroke:#5d82a8,color:#000000
      16("<div style='font-weight: bold'>Docket</div><div style='font-size: 70%; margin-top: 0px'>[Component]</div><div style='font-size: 80%; margin-top:10px'>Case Docket Entries</div>")
      style 16 fill:#85bbf0,stroke:#5d82a8,color:#000000
      17("<div style='font-weight: bold'>Case History</div><div style='font-size: 70%; margin-top: 0px'>[Component]</div><div style='font-size: 80%; margin-top:10px'>Case History API</div>")
      style 17 fill:#85bbf0,stroke:#5d82a8,color:#000000
      18("<div style='font-weight: bold'>Case Summary</div><div style='font-size: 70%; margin-top: 0px'>[Component]</div><div style='font-size: 80%; margin-top:10px'>Case Summary API</div>")
      style 18 fill:#85bbf0,stroke:#5d82a8,color:#000000
      19("<div style='font-weight: bold'>Offices</div><div style='font-size: 70%; margin-top: 0px'>[Component]</div><div style='font-size: 80%; margin-top:10px'>Offices API</div>")
      style 19 fill:#85bbf0,stroke:#5d82a8,color:#000000
      20("<div style='font-weight: bold'>Orders</div><div style='font-size: 70%; margin-top: 0px'>[Component]</div><div style='font-size: 80%; margin-top:10px'>Orders API</div>")
      style 20 fill:#85bbf0,stroke:#5d82a8,color:#000000
      21("<div style='font-weight: bold'>Orders Manual Sync</div><div style='font-size: 70%; margin-top: 0px'>[Component]</div><div style='font-size: 80%; margin-top:10px'>Orders Manual Sync API</div>")
      style 21 fill:#85bbf0,stroke:#5d82a8,color:#000000
      22("<div style='font-weight: bold'>Orders Suggestions</div><div style='font-size: 70%; margin-top: 0px'>[Component]</div><div style='font-size: 80%; margin-top:10px'>Orders Suggestions API</div>")
      style 22 fill:#85bbf0,stroke:#5d82a8,color:#000000
      23("<div style='font-weight: bold'>Sync</div><div style='font-size: 70%; margin-top: 0px'>[Component]</div><div style='font-size: 80%; margin-top:10px'>Creates events in CAMS based<br />on orders to transfer<br />transactions in DXTR</div>")
      style 23 fill:#85bbf0,stroke:#5d82a8,color:#000000
      24("<div style='font-weight: bold'>Consolidations</div><div style='font-size: 70%; margin-top: 0px'>[Component]</div><div style='font-size: 80%; margin-top:10px'>Consolidation Orders API</div>")
      style 24 fill:#85bbf0,stroke:#5d82a8,color:#000000
      25("<div style='font-weight: bold'>Associated Cases</div><div style='font-size: 70%; margin-top: 0px'>[Component]</div><div style='font-size: 80%; margin-top:10px'>Associated Cases API</div>")
      style 25 fill:#85bbf0,stroke:#5d82a8,color:#000000
    end

    8-. "<div>Reads and writes case data</div><div style='font-size: 70%'></div>" .->14
    8-. "<div>Reads and writes case<br />assignments</div><div style='font-size: 70%'></div>" .->15
    8-. "<div>Reads Manhattan attorneys</div><div style='font-size: 70%'></div>" .->13
    8-. "<div>Reads case docket entries</div><div style='font-size: 70%'></div>" .->16
    8-. "<div>Reads case audit history</div><div style='font-size: 70%'></div>" .->17
    8-. "<div>Reads case summary, a subset<br />of case details</div><div style='font-size: 70%'></div>" .->18
    8-. "<div>Reads USTP office information</div><div style='font-size: 70%'></div>" .->19
    8-. "<div>Reads case events</div><div style='font-size: 70%'></div>" .->20
    8-. "<div>Triggers order sync via HTTP</div><div style='font-size: 70%'></div>" .->21
    8-. "<div>Reads case summaries for data<br />verification</div><div style='font-size: 70%'></div>" .->22
    8-. "<div>Reads and writes<br />consolidation order data</div><div style='font-size: 70%'></div>" .->24
    8-. "<div>Reads associated orders from<br />consolidation</div><div style='font-size: 70%'></div>" .->25
    14-. "<div>Gets case data</div><div style='font-size: 70%'></div>" .->26
    14-. "<div>Reads case assignments</div><div style='font-size: 70%'></div>" .->27
    24-. "<div>Reads and Writes<br />consolidations</div><div style='font-size: 70%'></div>" .->27
    15-. "<div>Reads and writes case<br />assignments</div><div style='font-size: 70%'></div>" .->27
    16-. "<div>Reads case docket entries</div><div style='font-size: 70%'></div>" .->26
    17-. "<div>Reads case audit logs</div><div style='font-size: 70%'></div>" .->27
    18-. "<div>Reads case summaries</div><div style='font-size: 70%'></div>" .->26
    25-. "<div>Reads associated case<br />references</div><div style='font-size: 70%'></div>" .->27
    19-. "<div>Reads USTP office information</div><div style='font-size: 70%'></div>" .->26
    20-. "<div>Reads case events</div><div style='font-size: 70%'></div>" .->27
    21-. "<div>Writes case audit logs</div><div style='font-size: 70%'></div>" .->27
    22-. "<div>Reads case summaries matching<br />a case transfer event</div><div style='font-size: 70%'></div>" .->26
    23-. "<div>Writes case audit logs</div><div style='font-size: 70%'></div>" .->27
  end
```
