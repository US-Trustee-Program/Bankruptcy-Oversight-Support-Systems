# CAMS System Context

```mermaidgraph TB
  linkStyle default fill:#ffffff

  subgraph diagram [System Landscape]
    style diagram fill:#ffffff,stroke:#ffffff

    1["<div style='font-weight: bold'>AUST</div><div style='font-size: 70%; margin-top: 0px'>[Person]</div><div style='font-size: 80%; margin-top:10px'>Assistant United States<br />Trustee - manages a USTP<br />office</div>"]
    style 1 fill:#08427b,stroke:#052e56,color:#ffffff
    2["<div style='font-weight: bold'>Trial Attorney</div><div style='font-size: 70%; margin-top: 0px'>[Person]</div><div style='font-size: 80%; margin-top:10px'>Represents USTP in court<br />regarding bankruptcy cases</div>"]
    style 2 fill:#08427b,stroke:#052e56,color:#ffffff
    3("<div style='font-weight: bold'>CAMS</div><div style='font-size: 70%; margin-top: 0px'>[Software System]</div><div style='font-size: 80%; margin-top:10px'>CAse Management System</div>")
    style 3 fill:#1168bd,stroke:#0b4884,color:#ffffff

    1-. "<div>Assigns cases to attorneys</div><div style='font-size: 70%'></div>" .->3
    2-. "<div>Views bankruptcy cases</div><div style='font-size: 70%'></div>" .->3
  end
```
