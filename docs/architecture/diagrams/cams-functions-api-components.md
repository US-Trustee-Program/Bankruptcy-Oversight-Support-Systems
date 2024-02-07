# CAMS Functions API Components

```mermaidgraph TB
  linkStyle default fill:#ffffff

  subgraph diagram [CAMS - API - Components]
    style diagram fill:#ffffff,stroke:#ffffff

    22("<div style='font-weight: bold'>Cosmos DB</div><div style='font-size: 70%; margin-top: 0px'>[Container]</div><div style='font-size: 80%; margin-top:10px'>NoSQL Database</div>")
    style 22 fill:#438dd5,stroke:#2e6295,color:#ffffff
    5("<div style='font-weight: bold'>Webapp</div><div style='font-size: 70%; margin-top: 0px'>[Container]</div><div style='font-size: 80%; margin-top:10px'>The user interface for CAMS</div>")
    style 5 fill:#438dd5,stroke:#2e6295,color:#ffffff
    21("<div style='font-weight: bold'>DXTR DB</div><div style='font-size: 70%; margin-top: 0px'>[Container]</div><div style='font-size: 80%; margin-top:10px'>DXTR SQL Database</div>")
    style 21 fill:#438dd5,stroke:#2e6295,color:#ffffff

    subgraph 9 [API]
      style 9 fill:#ffffff,stroke:#2e6295,color:#2e6295

      10("<div style='font-weight: bold'>Attorneys</div><div style='font-size: 70%; margin-top: 0px'>[Component]</div><div style='font-size: 80%; margin-top:10px'>Attorneys API</div>")
      style 10 fill:#85bbf0,stroke:#5d82a8,color:#000000
      11("<div style='font-weight: bold'>Cases</div><div style='font-size: 70%; margin-top: 0px'>[Component]</div><div style='font-size: 80%; margin-top:10px'>Cases API</div>")
      style 11 fill:#85bbf0,stroke:#5d82a8,color:#000000
      12("<div style='font-weight: bold'>Assignments</div><div style='font-size: 70%; margin-top: 0px'>[Component]</div><div style='font-size: 80%; margin-top:10px'>Case Assignments API</div>")
      style 12 fill:#85bbf0,stroke:#5d82a8,color:#000000
      13("<div style='font-weight: bold'>Docket</div><div style='font-size: 70%; margin-top: 0px'>[Component]</div><div style='font-size: 80%; margin-top:10px'>Case Docket Entries</div>")
      style 13 fill:#85bbf0,stroke:#5d82a8,color:#000000
      14("<div style='font-weight: bold'>Case History</div><div style='font-size: 70%; margin-top: 0px'>[Component]</div><div style='font-size: 80%; margin-top:10px'>Case History API</div>")
      style 14 fill:#85bbf0,stroke:#5d82a8,color:#000000
      15("<div style='font-weight: bold'>Case Summary</div><div style='font-size: 70%; margin-top: 0px'>[Component]</div><div style='font-size: 80%; margin-top:10px'>Case Summary API</div>")
      style 15 fill:#85bbf0,stroke:#5d82a8,color:#000000
      16("<div style='font-weight: bold'>Offices</div><div style='font-size: 70%; margin-top: 0px'>[Component]</div><div style='font-size: 80%; margin-top:10px'>Offices API</div>")
      style 16 fill:#85bbf0,stroke:#5d82a8,color:#000000
      17("<div style='font-weight: bold'>Orders</div><div style='font-size: 70%; margin-top: 0px'>[Component]</div><div style='font-size: 80%; margin-top:10px'>Orders API</div>")
      style 17 fill:#85bbf0,stroke:#5d82a8,color:#000000
      18("<div style='font-weight: bold'>Orders Manual Sync</div><div style='font-size: 70%; margin-top: 0px'>[Component]</div><div style='font-size: 80%; margin-top:10px'>Orders Manual Sync API</div>")
      style 18 fill:#85bbf0,stroke:#5d82a8,color:#000000
      19("<div style='font-weight: bold'>Orders Suggestions</div><div style='font-size: 70%; margin-top: 0px'>[Component]</div><div style='font-size: 80%; margin-top:10px'>Orders Suggestions API</div>")
      style 19 fill:#85bbf0,stroke:#5d82a8,color:#000000
      20("<div style='font-weight: bold'>Sync</div><div style='font-size: 70%; margin-top: 0px'>[Component]</div><div style='font-size: 80%; margin-top:10px'>Creates events in CAMS based<br />on orders to transfer<br />transactions in DXTR</div>")
      style 20 fill:#85bbf0,stroke:#5d82a8,color:#000000
    end

    5-. "<div>Reads and writes case data</div><div style='font-size: 70%'></div>" .->11
    5-. "<div>Reads and writes case<br />assignments</div><div style='font-size: 70%'></div>" .->12
    5-. "<div>Reads Manhattan attorneys</div><div style='font-size: 70%'></div>" .->10
    5-. "<div>Reads case docket entries</div><div style='font-size: 70%'></div>" .->13
    5-. "<div>Reads case audit history</div><div style='font-size: 70%'></div>" .->14
    5-. "<div>Reads case summary, a subset<br />of case details</div><div style='font-size: 70%'></div>" .->15
    5-. "<div>Reads USTP office information</div><div style='font-size: 70%'></div>" .->16
    5-. "<div>Reads case events</div><div style='font-size: 70%'></div>" .->17
    5-. "<div>Triggers order sync via HTTP</div><div style='font-size: 70%'></div>" .->18
    5-. "<div>Reads case summaries for data<br />verification</div><div style='font-size: 70%'></div>" .->19
    11-. "<div>Gets case data</div><div style='font-size: 70%'></div>" .->21
    11-. "<div>Reads case assignments</div><div style='font-size: 70%'></div>" .->22
    12-. "<div>Reads and writes case<br />assignments</div><div style='font-size: 70%'></div>" .->22
    13-. "<div>Reads case docket entries</div><div style='font-size: 70%'></div>" .->21
    14-. "<div>Reads case audit logs</div><div style='font-size: 70%'></div>" .->22
    15-. "<div>Reads case summaries</div><div style='font-size: 70%'></div>" .->21
    16-. "<div>Reads USTP office information</div><div style='font-size: 70%'></div>" .->21
    17-. "<div>Reads case events</div><div style='font-size: 70%'></div>" .->22
    18-. "<div>Writes case audit logs</div><div style='font-size: 70%'></div>" .->22
    19-. "<div>Reads case summaries matching<br />a case transfer event</div><div style='font-size: 70%'></div>" .->21
    20-. "<div>Writes case audit logs</div><div style='font-size: 70%'></div>" .->22
  end
```
