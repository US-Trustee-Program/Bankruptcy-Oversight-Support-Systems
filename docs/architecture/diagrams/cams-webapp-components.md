# CAMS Webapp Components

```mermaidgraph TB
  linkStyle default fill:#ffffff

  subgraph diagram [CAMS - Webapp - Components]
    style diagram fill:#ffffff,stroke:#ffffff

    1["<div style='font-weight: bold'>AUST</div><div style='font-size: 70%; margin-top: 0px'>[Person]</div><div style='font-size: 80%; margin-top:10px'>Assistant United States<br />Trustee - manages a USTP<br />office</div>"]
    style 1 fill:#08427b,stroke:#052e56,color:#ffffff
    2["<div style='font-weight: bold'>Trial Attorney</div><div style='font-size: 70%; margin-top: 0px'>[Person]</div><div style='font-size: 80%; margin-top:10px'>Represents USTP in court<br />regarding bankruptcy cases</div>"]
    style 2 fill:#08427b,stroke:#052e56,color:#ffffff
    3["<div style='font-weight: bold'>Data Quality Analyst</div><div style='font-size: 70%; margin-top: 0px'>[Person]</div><div style='font-size: 80%; margin-top:10px'>Verify case events</div>"]
    style 3 fill:#08427b,stroke:#052e56,color:#ffffff

    subgraph 5 [Webapp]
      style 5 fill:#ffffff,stroke:#2e6295,color:#2e6295

      6("<div style='font-weight: bold'>Assignments Screen</div><div style='font-size: 70%; margin-top: 0px'>[Component]</div><div style='font-size: 80%; margin-top:10px'>Displays case assignment data<br />and provides for creating<br />assignments</div>")
      style 6 fill:#85bbf0,stroke:#5d82a8,color:#000000
      7("<div style='font-weight: bold'>Case Details Screen</div><div style='font-size: 70%; margin-top: 0px'>[Component]</div><div style='font-size: 80%; margin-top:10px'>Displays case data including<br />dates and assigned staff,<br />court docket, and audit<br />history</div>")
      style 7 fill:#85bbf0,stroke:#5d82a8,color:#000000
      8("<div style='font-weight: bold'>Data Verification Screen</div><div style='font-size: 70%; margin-top: 0px'>[Component]</div><div style='font-size: 80%; margin-top:10px'>Displays case events for data<br />quality analysts to review</div>")
      style 8 fill:#85bbf0,stroke:#5d82a8,color:#000000
    end

    2-. "<div>Views bankruptcy cases</div><div style='font-size: 70%'></div>" .->7
    1-. "<div>Assigns cases to attorneys</div><div style='font-size: 70%'></div>" .->6
    2-. "<div>Views cases assigned to them</div><div style='font-size: 70%'></div>" .->6
    3-. "<div>Reviews, approves, and<br />rejects case events</div><div style='font-size: 70%'></div>" .->8
  end
```
