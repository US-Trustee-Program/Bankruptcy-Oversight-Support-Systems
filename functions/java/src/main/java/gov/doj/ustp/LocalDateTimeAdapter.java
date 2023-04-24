package gov.doj.ustp;

import com.google.gson.JsonDeserializationContext;
import com.google.gson.JsonDeserializer;
import com.google.gson.JsonElement;
import com.google.gson.JsonParseException;
import com.google.gson.JsonPrimitive;
import com.google.gson.JsonSerializationContext;
import com.google.gson.JsonSerializer;
import java.lang.reflect.Type;
import java.time.LocalDateTime;

public class LocalDateTimeAdapter
    implements JsonSerializer<LocalDateTime>, JsonDeserializer<LocalDateTime> {
  @Override
  public JsonElement serialize(
      LocalDateTime dateTime, Type typeOfSrc, JsonSerializationContext context) {
    return new JsonPrimitive(dateTime.toString());
  }

  @Override
  public LocalDateTime deserialize(
      JsonElement json, Type typeOfT, JsonDeserializationContext context)
      throws JsonParseException {
    return LocalDateTime.parse(json.getAsJsonPrimitive().getAsString());
  }
}
