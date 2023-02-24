package gov.doj.adapters.gateways;

import gov.doj.usecases.PersistenceGateway;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.*;

public class AzureSqlGateway implements PersistenceGateway {
    public List<String> connect() throws Exception{

        List<String> cases = new ArrayList<>();
        ResultSet resultSet = null;

        Properties properties = new Properties();
        properties.load(AzureSqlGateway.class.getClassLoader().getResourceAsStream("application.properties"));

        try (Connection connection = DriverManager.getConnection(properties.getProperty("url"), properties);
             Statement statement = connection.createStatement();){

            String selectSql = "SELECT case_id, case_number  from Cases";
            resultSet = statement.executeQuery(selectSql);

            // Print results from select statement
            while (resultSet.next()) {
                cases.add(resultSet.getString(1) + " " + resultSet.getString(2));
                //System.out.println(resultSet.getString(1) + " " + resultSet.getString(2));
            }

            return cases;

        }
        catch (SQLException e) {

            throw new RuntimeException(e);
        }
    }
    @Override
    public List<String> getCases() {
        try {
            return connect();
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }
}
