package gov.doj;

import java.io.*;
import java.sql.*;

public class CMMCDLoader extends AbstractDataLoader implements IDataLoader{

    private final String tableName = "dbo.CMMCD";

    public CMMCDLoader() {
        setLoaderName("CMMCD");
    }
    public void initialize(String filePath)
     {
         setCsvFilePath(filePath);
     }



    @Override
    public void run() {

        //clear the table
        clearTable();

        //Load up the data
        loadTable();

        //Cleanup
    }

    @Override
    public void loadTable() {

        //Run the data load
        try (BufferedReader lineReader = new BufferedReader(new FileReader(getCsvFilePath()))) {

            String sql = "SET IDENTITY_INSERT dbo.CMMCD ON;INSERT INTO dbo.CMMCD (DELETE_CODE,CODE_TYPE,EVENT_CODE,EVENT_DESCRIPTION,REQUIRED_BY_DAYS,IS_KEY_EVENT,KEY_EVENT_TYPE,LIST_SEQUENCE,CYCLE_MONTH,CHAP_7A_IND,CHAP_7N_IND,CHAP_11_IND,CHAP_12_IND,CHAP_13_IND,CHAP_09_IND,CHAP_AC_IND,CHAPTER_FUTURE_3,ENTRY_DATE,USER_ID,ALLOW_MULT_OCCUR,CODE_OBJECTIVE,KEY_DATE_CODE,CONTROL_CD,REGION_CODE,GROUP_DESIGNATOR,RGN_CREATE_DATE,RGN_UPDATE_DATE,CDB_CREATE_DATE,CDB_UPDATE_DATE,ENTRY_DATE_DT,RGN_CREATE_DATE_DT,RGN_UPDATE_DATE_DT,CDB_CREATE_DATE_DT,CDB_UPDATE_DATE_DT,UPDATE_DATE,REPLICATED_DATE,id,RRN)"
                    + " VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";


            Connection connection = getConnection();
            PreparedStatement statement = connection.prepareStatement(sql);

            int count = 0;
            String lineText = null;

            lineReader.readLine(); // skip the header line



            while ((lineText = lineReader.readLine()) != null ){

                String[] data = lineText.split(",");
                //System.out.println("data:" + Arrays.toString(data));
                statement.setString(1, data[0]);
                statement.setString(2, data[1]);
                statement.setString(3, data[2]);
                statement.setString(4, data[3]);
                statement.setInt(5, Integer.parseInt(data[4]));
                statement.setString(6, data[5]);
                statement.setString(7, data[6]);
                statement.setInt(8, Integer.parseInt(data[7]));
                statement.setInt(9, Integer.parseInt(data[8]));
                statement.setString(10, data[9]);
                statement.setString(11, data[10]);
                statement.setString(12, data[11]);
                statement.setString(13, data[12]);
                statement.setString(14, data[13]);
                statement.setString(15, data[14]);
                statement.setString(16, data[15]);
                statement.setString(17, data[16]);
                statement.setInt(18, Integer.parseInt(data[17]));

                statement.setString(19, data[18].substring(0, 9));
                statement.setString(20, data[19]);
                statement.setString(21, data[20]);
                statement.setString(22, data[21]);
                statement.setString(23, data[22]);
                statement.setString(24, data[23]);
                statement.setString(25, data[24]);

                statement.setInt(26, Integer.parseInt(data[25]));
                statement.setInt(27, Integer.parseInt(data[26]));
                statement.setInt(28, Integer.parseInt(data[27]));
                statement.setInt(29, Integer.parseInt(data[28]));

                //Nullify timestamp columns - story#111

                if(data[29] == null || data[29] == "NULL" || data[29].isEmpty() || data[29].contains("NULL"))
                {
                    statement.setNull(30, Types.TIMESTAMP);
                }else {
                    //statement.setTimestamp(30, Timestamp.valueOf(data[29]));
                    statement.setNull(30, Types.TIMESTAMP);
                }

                if(data[30] == null|| data[30] == "NULL" || data[30].isEmpty() || data[30].contains("NULL"))
                {
                    statement.setNull(31, Types.TIMESTAMP);
                }else {
                    //statement.setTimestamp(31, Timestamp.valueOf(data[30]));
                    statement.setNull(31, Types.TIMESTAMP);
                }
                if(data[31] == null|| data[31] == "NULL" || data[31].isEmpty() || data[31].contains("NULL"))
                {
                    statement.setNull(32, Types.TIMESTAMP);
                }else {
                    //statement.setTimestamp(32, Timestamp.valueOf(data[31]));
                    statement.setNull(32, Types.TIMESTAMP);
                }
                if(data[32] == null|| data[33] == "NULL" || data[33].isEmpty() || data[33].contains("NULL"))
                {
                    statement.setNull(33, Types.TIMESTAMP);
                }else {
                    //statement.setTimestamp(33, Timestamp.valueOf(data[32]));
                    statement.setNull(33, Types.TIMESTAMP);
                }

                if(data[33] == null|| data[33] == "NULL" || data[33].isEmpty() || data[33].contains("NULL"))
                {
                    statement.setNull(34, Types.TIMESTAMP);
                }else {
                    //statement.setTimestamp(34, Timestamp.valueOf(data[33]));
                    statement.setNull(34, Types.TIMESTAMP);
                }
                if(data[34] == null|| data[34] == "NULL" || data[34].isEmpty() || data[34].contains("NULL"))
                {
                    statement.setNull(35, Types.TIMESTAMP);
                }else {
                    //statement.setTimestamp(35, Timestamp.valueOf(data[34])); //format exception
                    statement.setNull(35, Types.TIMESTAMP);
                }
                if(data[35] == null|| data[35] == "NULL" || data[35].isEmpty() || data[35].contains("NULL"))
                {
                    statement.setNull(36, Types.TIMESTAMP);
                }else {
                    //statement.setTimestamp(36, Timestamp.valueOf(data[35]));
                    statement.setNull(36, Types.TIMESTAMP);
                }


                statement.setInt(37, Integer.parseInt(data[36]));

                statement.setInt(38, Integer.parseInt(data[37]));

                boolean rowInserted = statement.executeUpdate() > 0;

                count++;
                System.out.println("RowInserted : " + rowInserted + ". Row Number : " + count );

            }


        }
        catch (FileNotFoundException e) {
            throw new RuntimeException(e);
        }
        catch (IOException e) {
            throw new RuntimeException(e);
        } catch (SQLException e) {
            throw new RuntimeException(e);
        }

    }

    @Override
    public void clearTable() {
        try (Connection connection = getConnection()) {

            String truncateSql = "TRUNCATE TABLE dbo.CMMCD";
            Statement statement = connection.createStatement();
            statement.executeUpdate(truncateSql);


        } catch (SQLException e) {
            e.printStackTrace();
        }
    }

    private boolean setIdentityInsertOn()
    {
        try (Connection connection = getConnection()) {

            String identitySql = "SET IDENTITY_INSERT dbo.CMMCD ON";
            Statement statement = connection.createStatement();
            return statement.execute(identitySql);


        } catch (SQLException e) {
            e.printStackTrace();
        }
        return false;
    }

    private void setIdentityInsertOff()
    {
        try (Connection connection = getConnection()) {

            String identitySql = "SET IDENTITY_INSERT dbo.CMMCD OFF";
            Statement statement = connection.createStatement();
            ResultSet resultSet = statement.executeQuery(identitySql);


        } catch (SQLException e) {
            e.printStackTrace();
        }
    }


}
