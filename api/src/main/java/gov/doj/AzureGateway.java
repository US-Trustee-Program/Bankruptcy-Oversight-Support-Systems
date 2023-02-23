package gov.doj;

import java.sql.*;
import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.Properties;
import java.util.*;

public class AzureGateway {
    public List<String> connectWithSecret() throws Exception {

        List<String> cases = new ArrayList<>();
        ResultSet resultSet = null;

        Properties properties = new Properties();
        properties.load(AzureGateway.class.getClassLoader().getResourceAsStream("application.properties"));

        try (Connection connection = DriverManager.getConnection(properties.getProperty("url"), properties);
             Statement statement = connection.createStatement();){

            String selectSql = "SELECT case_id, case_number  from Cases";
            resultSet = statement.executeQuery(selectSql);

            // Print results from select statement
            while (resultSet.next()) {
                cases.add(resultSet.getString(1) + " " + resultSet.getString(2));
                System.out.println(resultSet.getString(1) + " " + resultSet.getString(2));
            }

            return cases;

        }
        catch (SQLException e) {

            throw new RuntimeException(e);
        }
    }

}
