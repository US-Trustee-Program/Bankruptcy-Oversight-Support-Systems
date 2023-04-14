package gov.doj.adapters.presenters;

import gov.doj.Presenter;

public class JsonPresenter implements Presenter {

  @Override
  public void onSuccess(Object content) {
    System.out.println(content);
  }

  @Override
  public void onFailure(Exception e) {
    System.out.println(e);
  }
}
