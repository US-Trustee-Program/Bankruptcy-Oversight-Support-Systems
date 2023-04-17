package gov.doj.ustp.entities;

public class BossResponse {
  private String message;
  private Integer count;
  private Object body;

  public static class Builder {
    private String builderMessage;
    private Integer builderCount;
    private Object builderBody;

    public Builder() {}

    public Builder message(String message) {
      this.builderMessage = message;
      return this;
    }

    public Builder count(Integer count) {
      this.builderCount = count;
      return this;
    }

    public Builder body(Object body) {
      this.builderBody = body;
      return this;
    }

    public BossResponse build() {
      BossResponse response = new BossResponse();
      response.message = this.builderMessage;
      response.count = this.builderCount;
      response.body = this.builderBody;
      return response;
    }
  }

  public String getMessage() {
    return message;
  }

  public void setMessage(String message) {
    this.message = message;
  }

  public Integer getCount() {
    return count;
  }

  public void setCount(Integer count) {
    this.count = count;
  }

  public Object getBody() {
    return body;
  }

  public void setBody(Object body) {
    this.body = body;
  }
}
