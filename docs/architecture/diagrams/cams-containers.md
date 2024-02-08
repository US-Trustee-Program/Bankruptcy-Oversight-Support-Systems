# CAMS Containers

```mermaidgraph TB
  linkStyle default fill:#ffffff

  subgraph diagram [CAMS - Containers]
    style diagram fill:#ffffff,stroke:#ffffff

    1["<div style='font-weight: bold'>AUST</div><div style='font-size: 70%; margin-top: 0px'>[Person]</div><div style='font-size: 80%; margin-top:10px'>Assistant United States<br />Trustee - manages a USTP<br />office</div>"]
    style 1 fill:#08427b,stroke:#052e56,color:#ffffff
    2["<div style='font-weight: bold'>Trial Attorney</div><div style='font-size: 70%; margin-top: 0px'>[Person]</div><div style='font-size: 80%; margin-top:10px'>Represents USTP in court<br />regarding bankruptcy cases</div>"]
    style 2 fill:#08427b,stroke:#052e56,color:#ffffff
    3["<div style='font-weight: bold'>Data Quality Analyst</div><div style='font-size: 70%; margin-top: 0px'>[Person]</div><div style='font-size: 80%; margin-top:10px'>Verify case events</div>"]
    style 3 fill:#08427b,stroke:#052e56,color:#ffffff

    subgraph 4 [CAMS]
      style 4 fill:#ffffff,stroke:#0b4884,color:#0b4884

      21("<div style='font-weight: bold'>DXTR DB</div><div style='font-size: 70%; margin-top: 0px'>[Container]</div><div style='font-size: 80%; margin-top:10px'>DXTR SQL Database</div>")
      style 21 fill:#438dd5,stroke:#2e6295,color:#ffffff
      22("<div style='font-weight: bold'>Cosmos DB</div><div style='font-size: 70%; margin-top: 0px'>[Container]</div><div style='font-size: 80%; margin-top:10px'>NoSQL Database</div>")
      style 22 fill:#438dd5,stroke:#2e6295,color:#ffffff
      5("<div style='font-weight: bold'>Webapp</div><div style='font-size: 70%; margin-top: 0px'>[Container]</div><div style='font-size: 80%; margin-top:10px'>The user interface for CAMS</div>")
      style 5 fill:#438dd5,stroke:#2e6295,color:#ffffff
      9("<div style='font-weight: bold'>API</div><div style='font-size: 70%; margin-top: 0px'>[Container]</div><div style='font-size: 80%; margin-top:10px'>An Azure Functions App<br />(Node.js)</div>")
      style 9 fill:#438dd5,stroke:#2e6295,color:#ffffff
    end

    1-. "<div>Assigns cases to attorneys</div><div style='font-size: 70%'></div>" .->5
    2-. "<div>Views bankruptcy cases</div><div style='font-size: 70%'></div>" .->5
    3-. "<div>Reviews, approves, and<br />rejects case events</div><div style='font-size: 70%'></div>" .->5
    5-. "<div>Reads and writes case data<br />and assignments</div><div style='font-size: 70%'></div>" .->9
    9-. "<div>Reads and writes case<br />assignments, orders, cases,<br />etc.</div><div style='font-size: 70%'></div>" .->22
    9-. "<div>Gets case data</div><div style='font-size: 70%'></div>" .->21
  end
```
