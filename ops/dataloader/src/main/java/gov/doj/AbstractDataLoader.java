package gov.doj;

public class AbstractDataLoader {

  private String loaderName;
  private String csvFilePath;

  public String getLoaderName() {
    return loaderName;
  }

  protected void setLoaderName(String loaderName) {
    this.loaderName = loaderName;
  }

  public String getCsvFilePath() {
    return csvFilePath;
  }

  protected void setCsvFilePath(String csvFilePath) {
    this.csvFilePath = csvFilePath;
  }
}
