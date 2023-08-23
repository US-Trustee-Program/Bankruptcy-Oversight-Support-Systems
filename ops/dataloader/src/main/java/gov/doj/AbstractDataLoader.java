package gov.doj;

import java.sql.PreparedStatement;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.sql.Types;

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

  protected void setTimestampNull(int dataIndex, PreparedStatement statement) throws SQLException {
    statement.setNull(dataIndex, Types.TIMESTAMP); // Nullify timestamp columns - story#111
  }

  protected void setTimestamp(int dataIndex, String data, PreparedStatement statement)
      throws SQLException, IllegalArgumentException {
    if (data == null || "".equals(data)) {
      statement.setNull(dataIndex, Types.TIMESTAMP);
    } else {
      statement.setTimestamp(dataIndex, Timestamp.valueOf(data));
    }
  }
}
