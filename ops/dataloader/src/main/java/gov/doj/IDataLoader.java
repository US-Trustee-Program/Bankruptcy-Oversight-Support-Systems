package gov.doj;

public interface IDataLoader {

  void run();

  void initialize(String filePath);

  void loadTable();

  void clearTable();
}
