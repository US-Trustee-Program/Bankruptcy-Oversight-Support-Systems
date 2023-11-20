# CAMS Functions API Components

```mermaidgraph TB
  linkStyle default fill:#ffffff

  subgraph diagram [CAMS - API - Components]
    style diagram fill:#ffffff,stroke:#ffffff

    12("<div style='font-weight: bold'>DXTR DB</div><div style='font-size: 70%; margin-top: 0px'>[Container]</div><div style='font-size: 80%; margin-top:10px'>DXTR SQL Database</div>")
    style 12 fill:#438dd5,stroke:#2e6295,color:#ffffff
    13("<div style='font-weight: bold'>Cosmos DB</div><div style='font-size: 70%; margin-top: 0px'>[Container]</div><div style='font-size: 80%; margin-top:10px'>NoSQL Database</div>")
    style 13 fill:#438dd5,stroke:#2e6295,color:#ffffff
    4("<div style='font-weight: bold'>Webapp</div><div style='font-size: 70%; margin-top: 0px'>[Container]</div><div style='font-size: 80%; margin-top:10px'>The user interface for CAMS</div>")
    style 4 fill:#438dd5,stroke:#2e6295,color:#ffffff

    subgraph 7 [API]
      style 7 fill:#ffffff,stroke:#2e6295,color:#2e6295

      10("<div style='font-weight: bold'>Attorneys</div><div style='font-size: 70%; margin-top: 0px'>[Component]</div><div style='font-size: 80%; margin-top:10px'>Attorneys API</div>")
      style 10 fill:#85bbf0,stroke:#5d82a8,color:#000000
      11("<div style='font-weight: bold'>Docket</div><div style='font-size: 70%; margin-top: 0px'>[Component]</div><div style='font-size: 80%; margin-top:10px'>Case Docket Entries</div>")
      style 11 fill:#85bbf0,stroke:#5d82a8,color:#000000
      8("<div style='font-weight: bold'>Cases</div><div style='font-size: 70%; margin-top: 0px'>[Component]</div><div style='font-size: 80%; margin-top:10px'>Cases API</div>")
      style 8 fill:#85bbf0,stroke:#5d82a8,color:#000000
      9("<div style='font-weight: bold'>Assignments</div><div style='font-size: 70%; margin-top: 0px'>[Component]</div><div style='font-size: 80%; margin-top:10px'>Assignments API</div>")
      style 9 fill:#85bbf0,stroke:#5d82a8,color:#000000
    end

    4-. "<div>Reads and writes case data</div><div style='font-size: 70%'></div>" .->8
    4-. "<div>Reads and writes case<br />assignments</div><div style='font-size: 70%'></div>" .->9
    4-. "<div>Reads Manhattan attorneys</div><div style='font-size: 70%'></div>" .->10
    4-. "<div>Reads case docket entries</div><div style='font-size: 70%'></div>" .->11
    8-. "<div>Gets case data</div><div style='font-size: 70%'></div>" .->12
    8-. "<div>Reads case assignments</div><div style='font-size: 70%'></div>" .->13
    9-. "<div>Reads and writes case<br />assignments</div><div style='font-size: 70%'></div>" .->13
  end
```
