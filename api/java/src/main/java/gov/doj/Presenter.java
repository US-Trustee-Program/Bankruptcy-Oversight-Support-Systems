package gov.doj;

public interface Presenter {
  void onSuccess(Object content);

  void onFailure(Exception e);
}
