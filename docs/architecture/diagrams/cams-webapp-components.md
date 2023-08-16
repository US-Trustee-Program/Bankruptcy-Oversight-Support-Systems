# CAMS Webapp Components

```mermaid
graph TB
  linkStyle default fill:#ffffff

  subgraph diagram [CAMS - Webapp - Components]
    style diagram fill:#ffffff,stroke:#ffffff

    1["<div style='font-weight: bold'>AUST</div><div style='font-size: 70%; margin-top: 0px'>[Person]</div><div style='font-size: 80%; margin-top:10px'>Assistant United States<br />Trustee - manages a USTP<br />office</div>"]
    style 1 fill:#08427b,stroke:#052e56,color:#ffffff
    2["<div style='font-weight: bold'>Trial Attorney</div><div style='font-size: 70%; margin-top: 0px'>[Person]</div><div style='font-size: 80%; margin-top:10px'>Represents USTP in court<br />regarding bankruptcy cases</div>"]
    style 2 fill:#08427b,stroke:#052e56,color:#ffffff

    subgraph 4 [Webapp]
      style 4 fill:#ffffff,stroke:#2e6295,color:#2e6295

      5("<div style='font-weight: bold'>Cases Screen</div><div style='font-size: 70%; margin-top: 0px'>[Component]</div><div style='font-size: 80%; margin-top:10px'>Displays case metadata in a<br />tabular format</div>")
      style 5 fill:#85bbf0,stroke:#5d82a8,color:#000000
      6("<div style='font-weight: bold'>Assignments Screen</div><div style='font-size: 70%; margin-top: 0px'>[Component]</div><div style='font-size: 80%; margin-top:10px'>Displays case assignment data<br />and provides for creating<br />assignments</div>")
      style 6 fill:#85bbf0,stroke:#5d82a8,color:#000000
    end

    2-. "<div>Views bankruptcy cases</div><div style='font-size: 70%'></div>" .->5
    1-. "<div>Assigns cases to attorneys</div><div style='font-size: 70%'></div>" .->6
    2-. "<div>Views cases assigned to them</div><div style='font-size: 70%'></div>" .->6
  end
```
