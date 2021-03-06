/*
 *    Copyright (c) 2014-2017 Neil Ellis
 *
 *    Licensed under the Apache License, Version 2.0 (the "License");
 *    you may not use this file except in compliance with the License.
 *    You may obtain a copy of the License at
 *
 *          http://www.apache.org/licenses/LICENSE-2.0
 *
 *    Unless required by applicable law or agreed to in writing, software
 *    distributed under the License is distributed on an "AS IS" BASIS,
 *    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *    See the License for the specific language governing permissions and
 *    limitations under the License.
 */

package dollar;


import com.google.common.io.ByteStreams;
import com.google.common.io.Files;
import com.google.common.io.Resources;
import dollar.api.DollarStatic;
import dollar.api.Value;
import dollar.api.json.JsonArray;
import org.apache.commons.lang.StringUtils;
import org.jetbrains.annotations.NotNull;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

import java.io.File;
import java.io.IOException;
import java.nio.charset.Charset;
import java.util.List;
import java.util.SortedSet;
import java.util.TreeSet;
import java.util.function.Function;

import static dollar.test.TestGenerator.*;
import static org.junit.Assert.fail;

public class DollarOperatorsRegressionTest {

    @BeforeAll
    public static void after() {
        DollarStatic.getConfig().failFast(true);
    }

    @BeforeAll
    public static void before() {
        DollarStatic.getConfig().failFast(false);
    }

    public void diff(@NotNull String desc, @NotNull String lhs, @NotNull String rhs) {
        final String difference = StringUtils.difference(lhs, rhs);
        if (!difference.isEmpty()) {
            fail("Difference for " + desc + " is " + difference + "\nCompare previous: " + lhs + "\nWith current " + rhs);
        }
    }

    private void diff(@NotNull String desc, @NotNull JsonArray lhs, @NotNull JsonArray rhs) {
        final List lhsArray = lhs.toStringList();
        final List rhsArray = rhs.toStringList();
        if (lhsArray.size() != rhsArray.size()) {
            fail("Different lengths for " + desc);
        } else {
            for (int i = 0; i < lhsArray.size(); i++) {
                if (!lhsArray.get(i).toString().equals(rhsArray.get(i).toString())) {
                    fail("Difference between: \n" + lhsArray.get(i) + "\n\nAnd:\n" + rhsArray.get(i) + "\n\n ");
                }
            }
        }
    }

    public void regression(@NotNull String symbol,
                           @NotNull String operation,
                           @NotNull String variant,
                           @NotNull List<List<Value>> result) throws
            IOException {
        String filename = operation + "." + variant + ".json";
        final JsonArray previous = new JsonArray(new String(ByteStreams.toByteArray(
                getClass().getResourceAsStream("/" + filename))));
        //Use small to stop massive string creation
        final File file = new File("target", filename);
        final Value current = DollarStatic.$(result);
        Files.write(current.jsonArray().encodePrettily(), file, Charset.forName("utf-8"));
        System.out.println(file.getAbsolutePath());
        SortedSet<String> typeComparison = new TreeSet<>();
        SortedSet<String> humanReadable = new TreeSet<>();
        for (List<Value> res : result) {
            if (res.size() != 3) {
                throw new IllegalStateException(res.toString());
            }

            typeComparison.add(res.get(0).$type() +
                                       " " +
                                       operation +
                                       " " +
                                       res.get(1).$type() +
                                       " = " +
                                       res.get(2).$type());
            humanReadable.add(res.get(0).toDollarScript() +
                                      " " +
                                      symbol +
                                      " " +
                                      res.get(1).toDollarScript() +
                                      " <=> " +
                                      res.get(2).toDollarScript());
        }
        final String typesFile = operation + "." + variant + ".types.txt";
        final String humanFile = operation + "." + variant + ".ds";
        Files.asCharSink(new File("target", typesFile), Charset.forName("utf-8")).writeLines(typeComparison);
        Files.asCharSink(new File("target", humanFile), Charset.forName("utf-8")).writeLines(humanReadable);
        final TreeSet previousTypeComparison = new TreeSet<>(Resources.asCharSource(getClass().getResource("/" + typesFile),
                                                                                    Charset.forName("utf-8")).readLines());
        diff("type", previousTypeComparison.toString(), typeComparison.toString());
        diff("result", previous, current.jsonArray());
    }

    @Test
    public void testDivide() throws IOException {
        final Function<List<Value>, Value> operation = v -> v.get(0).$divide(v.get(1));
        regression("/", "divide", "all", testBinary(allValues(), noSmallDecimals(), operation));
        regression("/", "divide", "minimal", testBinary(minimal(), noSmallDecimals(), operation));
    }

    @Test
    public void testMinus() throws IOException {
        final Function<List<Value>, Value> operation = v -> v.get(0).$minus(v.get(1));
        regression("-", "minus", "small", testBinary(small(), small(), operation));
        regression("-", "minus", "minimal", testBinary(allValues(), allValues(), operation));
    }

    @Test
    public void testPlus() throws IOException {
        final Function<List<Value>, Value> operation = v -> v.get(0).$plus(v.get(1));
        regression("+", "plus", "all", testBinary(allValues(), allValues(), operation));
        regression("+", "plus", "minimal", testBinary(minimal(), minimal(), operation));
    }
}
