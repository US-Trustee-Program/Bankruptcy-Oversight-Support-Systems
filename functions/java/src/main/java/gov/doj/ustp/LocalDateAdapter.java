package gov.doj.ustp;

import com.google.gson.JsonDeserializationContext;
import com.google.gson.JsonDeserializer;
import com.google.gson.JsonElement;
import com.google.gson.JsonParseException;
import com.google.gson.JsonPrimitive;
import com.google.gson.JsonSerializationContext;
import com.google.gson.JsonSerializer;

import java.lang.reflect.Type;
import java.time.LocalDate;

public class LocalDateAdapter implements JsonSerializer<LocalDate>, JsonDeserializer<LocalDate> {
  @Override
  public JsonElement serialize(LocalDate date, Type typeOfSrc, JsonSerializationContext context) {
    return new JsonPrimitive(date.toString());
  }

  @Override
  public LocalDate deserialize(JsonElement json, Type typeOfT, JsonDeserializationContext context)
      throws JsonParseException {
    return LocalDate.parse(json.getAsJsonPrimitive().getAsString());
  }
}
