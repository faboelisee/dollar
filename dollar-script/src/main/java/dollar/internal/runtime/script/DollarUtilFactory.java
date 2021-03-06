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

package dollar.internal.runtime.script;

import dollar.api.DollarStatic;
import dollar.api.Pipeable;
import dollar.api.Scope;
import dollar.api.SubType;
import dollar.api.Type;
import dollar.api.TypePrediction;
import dollar.api.Value;
import dollar.api.VarFlags;
import dollar.api.VarKey;
import dollar.api.Variable;
import dollar.api.script.DollarParser;
import dollar.api.script.Source;
import dollar.api.types.NotificationType;
import dollar.internal.runtime.script.api.DollarUtil;
import dollar.internal.runtime.script.api.ScopeExecutable;
import dollar.internal.runtime.script.api.exceptions.DollarAssertionException;
import dollar.internal.runtime.script.api.exceptions.DollarScriptException;
import dollar.internal.runtime.script.api.exceptions.PureFunctionException;
import dollar.internal.runtime.script.api.exceptions.VariableNotFoundException;
import dollar.internal.runtime.script.parser.Op;
import dollar.internal.runtime.script.parser.SourceImpl;
import dollar.internal.runtime.script.parser.SourceNode;
import dollar.internal.runtime.script.parser.SourceNodeOptions;
import dollar.internal.runtime.script.parser.scope.PureScope;
import dollar.internal.runtime.script.parser.scope.ScriptScope;
import org.jetbrains.annotations.NotNull;
import org.jetbrains.annotations.Nullable;
import org.jparsec.Token;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.lang.reflect.Proxy;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

import static dollar.api.DollarStatic.*;
import static dollar.api.types.DollarFactory.wrap;
import static dollar.api.types.meta.MetaConstants.TYPE_HINT;
import static dollar.api.types.meta.MetaConstants.VARIABLE;
import static dollar.internal.runtime.script.parser.DollarParserImpl.NAMED_PARAMETER_META_ATTR;
import static dollar.internal.runtime.script.parser.Symbols.VAR_USAGE_OP;
import static java.lang.String.format;

public final class DollarUtilFactory implements DollarUtil {

    @NotNull
    static final ThreadLocal<List<Scope>> scopes = ThreadLocal.withInitial(() -> {
        ArrayList<Scope> list = new ArrayList<>();
        list.add(new ScriptScope("thread-" + Thread.currentThread().getId(), false, false));
        return list;
    });
    @NotNull
    private static final DollarUtilFactory instance = new DollarUtilFactory();
    @NotNull
    private static final Logger log = LoggerFactory.getLogger(DollarUtilFactory.class);

    public static DollarUtil util() {
        return instance;
    }

    @Override
    public void addParameterstoCurrentScope(@NotNull Scope scope, @NotNull List<Value> parameters) {
        //Add the special $* value for all the parameters
        int count = 0;
        List<Value> fixedParams = new ArrayList<>();
        for (Value parameter : parameters) {
            Value fixedParam = parameter.$fix(1, false);
            fixedParams.add(fixedParam);
            scope.parameter(VarKey.of(++count), fixedParam);

            //If the parameter is a named parameter then use the name (set as metadata on the value).
            String paramMetaAttribute = fixedParam.metaAttribute(NAMED_PARAMETER_META_ATTR);
            if (paramMetaAttribute != null) {
                scope.parameter(VarKey.of(paramMetaAttribute), fixedParam);
            }
        }
        scope.parameter(VarKey.STAR, $(fixedParams));
    }

    @Override
    public void addScope(boolean runtime, @NotNull Scope scope) {
        boolean newScope = scopes.get().isEmpty() || !scope.equals(scope());
        scopes.get().add(scope);
        if (getConfig().debugScope()) {
            log.info("{}{}BEGIN {}", indent(scopes.get().size() - 1), runtime ? "**** " : "", scope);
        }

    }

    @Override
    public void checkLearntType(@NotNull Token token, @Nullable Type type, @NotNull Value rhs, @NotNull Double threshold) {
        final TypePrediction prediction = rhs.predictType();
        if ((type != null) && (prediction != null)) {
            final Double probability = prediction.probability(type);
            log.info("Predicted {} at {}", prediction.probableType(), (new SourceImpl(scope(),
                                                                                      token)).getShortSourceMessage());
            if ((probability < threshold) && !prediction.empty()) {
                log.warn("Type assertion may fail, expected {} most likely type is {} ({}%) at {}", type,
                         prediction.probableType(),
                         (int) (prediction.probability(prediction.probableType()) * 100),
                         new SourceImpl(scope(), token).getSourceMessage()
                );
                if (getConfig().failFast()) {
                    throw new DollarScriptException(format(
                            "Type prediction failed, was expecting %s but most likely type is %s (%d%% certain) if this " +
                                    "prediction is wrong please add an explicit cast (using 'as %s'). Type key was %s",
                            type, prediction.probableType(), (int) (prediction.probability(prediction.probableType()) * 100),
                            type.name(),
                            prediction.name()));
                }
            }
        }
    }

    @NotNull
    @Override
    public Value constrain(@NotNull Scope scope,
                           @NotNull Value value,
                           @Nullable Value constraint,
                           @Nullable SubType label) {
        SubType valueLabel = value.constraintLabel();
        if (!Objects.equals(valueLabel, label)) {
            if ((label != null) && (valueLabel != null) && !valueLabel.isEmpty()) {
                scope.handleError(
                        new DollarScriptException(format("Trying to assign an invalid constrained variable %s vs %s",
                                                         valueLabel, label),
                                                  value));
            }
        }
        if (constraint == null) {
            return value;
        } else {
            return value.$constrain(constraint, label);
        }
    }

    @Override
    @NotNull
    public String createId(@NotNull String operation) {
        return operation + "-" + UUID.randomUUID();
    }

    @Override
    @NotNull
    public Scope endScope(boolean runtime) {

        Scope remove = scopes.get().remove(scopes.get().size() - 1);
        if (getConfig().debugScope()) {
            log.info("{}{}END:  {}", indent(scopes.get().size()), runtime ? "**** " : "", remove);
        }

        return remove;
    }

    /**
     * Fix Value.
     *
     * @param v        the v
     * @param parallel Should execution be in parallel?
     * @return the Value
     */
    @Override
    @NotNull
    public Value fix(@Nullable Value v, boolean parallel) {
        return (v != null) ? wrap(v.$fix(parallel)) : $void();
    }

    /**
     * Fix Value.
     *
     * @param v the v
     * @return the Value
     */
    @Override
    @NotNull
    public Value fix(@Nullable Value v) {
        return (v != null) ? wrap(v.$fix(false)) : $void();
    }

    @Override
    @NotNull
    public Scope getRootScope() {
        return scopes.get().get(0);
    }

    @Override
    public void setRootScope(@NotNull ScriptScope rootScope) {
        scopes.get().add(0, rootScope);
    }

    @Override
    @Nullable
    public Scope getScopeForVar(boolean pure,
                                @NotNull VarKey key,
                                boolean numeric,
                                @Nullable Scope initialScope) {
        Scope startingScope = initialScope;

        if (startingScope == null) {
            startingScope = scope();
        }
        if (getConfig().debugScope()) {
            log.info("{} {} in {} scopes ", highlight("LOOKUP " + key, ANSI_CYAN), startingScope, scopes.get().size());
        }
        if (numeric) {
            if (startingScope.hasParameter(key)) {
                return startingScope;
            }
        } else {
            if (startingScope.has(key)) {
                return startingScope;
            }
        }

        List<Scope> scopes = new ArrayList<>(DollarUtilFactory.scopes.get());
        Collections.reverse(scopes);
        for (Scope scriptScope : scopes) {
            if (!(scriptScope instanceof PureScope) && pure) {
                log.debug("Skipping {}", scriptScope);
            }
            if (numeric) {
                if (scriptScope.hasParameter(key)) {
                    return scriptScope;
                }
            } else {
                if (scriptScope.has(key)) {

                    return scriptScope;
                }
            }
        }

        return null;


    }

    @Override
    @NotNull
    public Value getVar(@NotNull VarKey key,
                        @NotNull UUID id,
                        @NotNull Scope scopeForKey,
                        @NotNull Source sourceCode,
                        boolean pure,
                        @NotNull Value node) {
        log.debug("Listening to scope {} for key {}", scopeForKey, key);
        scopeForKey.listen(key, id.toString(), node);
        Variable v = scopeForKey.variable(key);
        if (!v.isPure() && (pure || scopeForKey.pure())) {
            scopeForKey.handleError(
                    new PureFunctionException("Attempted to use an impure variable " + key + " in a " +
                                                      "pure context " + scopeForKey, sourceCode));
        }
        return v.getValue();
    }

    @Override
    @NotNull
    public String highlight(@NotNull String text, @NotNull String color) {
        if (getConfig().colorHighlighting()) {
            return "\u001b["  // Prefix
                           + "0"        // Brightness
                           + ";"        // Separator
                           + color       // Red foreground
                           + "m"        // Suffix
                           + text       // the text to output
                           + "\u001b[m"; // Prefix + Suffix to reset color
        } else {
            return "***" + text + "***";
        }
    }

    @NotNull
    @Override
    public <T> Optional<T> inScope(boolean runtime,
                                   @NotNull Scope parent,
                                   boolean pure,
                                   @NotNull String scopeName,
                                   @NotNull ScopeExecutable<T> r) {
        Scope newScope;
        if (pure) {
            newScope = new PureScope(parent, parent.source(), scopeName, parent.file());
        } else {
            if ((parent instanceof PureScope)) {
                throw new IllegalStateException(
                                                       "trying to switch to an impure scope in a pure scope.");
            }
            newScope = new ScriptScope(parent, parent.source(), scopeName,
                                       false, false);
        }
        addScope(runtime, parent);
        addScope(runtime, newScope);
        try {
            return Optional.ofNullable(r.execute(newScope));
        } catch (Exception e) {
            newScope.handleError(e);
            return Optional.ofNullable(null);
        } finally {
            Scope poppedScope = endScope(runtime);
//            poppedScope.destroy();
            if (!Objects.equals(poppedScope, newScope)) {
                throw new IllegalStateException("Popped wrong scope");
            }
            final Scope poppedScope2 = endScope(runtime);
            if (!Objects.equals(poppedScope2, parent)) {
                throw new IllegalStateException("Popped wrong scope");
            }
        }
    }

    @NotNull
    @Override
    public <T> Optional<T> inScope(boolean runtime,
                                   @NotNull Scope scope,
                                   @NotNull ScopeExecutable<T> r) {

        final boolean scopeAdded;
        if (scopes.get().get(scopes.get().size() - 1).equals(scope)) {
            scopeAdded = false;
        } else {
            addScope(runtime, scope);
            scopeAdded = true;
        }
        try {
            return Optional.ofNullable(r.execute(scope));
        } catch (Exception e) {
            scope.handleError(e);
            return Optional.ofNullable(null);
        } finally {
            if (scopeAdded) {
                Scope poppedScope = endScope(runtime);
                if (!Objects.equals(poppedScope, scope)) {
                    throw new IllegalStateException("Popped wrong scope");
                }
            }

        }
    }

    @Override
    @NotNull
    public <T> Optional<T> inSubScope(boolean runtime, boolean pure,
                                      @NotNull String scopeName,
                                      @NotNull ScopeExecutable<T> r) {
        return inScope(runtime, scope(), pure, scopeName, r);
    }

    @Override
    public String indent(int i) {
        StringBuilder b = new StringBuilder();
        for (int j = 0; j < i; j++) {
            b.append(" ");
        }
        return b.toString();
    }

    @NotNull
    @Override
    public Value node(@NotNull Op operation,
                      @NotNull String name,
                      boolean pure,
                      @NotNull SourceNodeOptions sourceNodeOptions,
                      @NotNull DollarParser parser,
                      @NotNull Source source,
                      @Nullable Type suggestedType, @NotNull List<Value> inputs,
                      @NotNull Pipeable pipeable) {

        Value result = wrap((Value) Proxy.newProxyInstance(
                DollarStatic.class.getClassLoader(),
                new Class<?>[]{Value.class},
                new SourceNode(pipeable, source, inputs, name, parser,
                               sourceNodeOptions, createId(name), pure, operation)));

        try {
            if (suggestedType != null) {
                result.meta(TYPE_HINT, suggestedType);
            } else {
                Type type = operation.typeFor(inputs.toArray(new Value[inputs.size()]));
                if (type != null) {
                    result.meta(TYPE_HINT, type);
                }
            }
            return result;
        } catch (RuntimeException e) {
            throw new DollarScriptException(e, source);
        }
    }

    @Override
    @NotNull
    public Value node(@NotNull Op operation,
                      boolean pure,
                      @NotNull DollarParser parser,
                      @NotNull Source source,
                      @NotNull List<Value> inputs,
                      @NotNull Pipeable pipeable) {
        return node(operation, operation.name(), pure, operation.nodeOptions(), parser, source, null, inputs, pipeable);
    }

    @Override
    @NotNull
    public Value node(@NotNull Op operation,
                      boolean pure,
                      @NotNull DollarParser parser,
                      @NotNull Token token,
                      @NotNull List<Value> inputs,
                      @NotNull Pipeable callable) {
        return node(operation, operation.name(), pure, operation.nodeOptions(), parser,
                    new SourceImpl(scope(), token), null, inputs, callable);
    }

    @Override
    @NotNull
    public Value node(@NotNull Op operation,
                      @NotNull String name,
                      boolean pure,
                      @NotNull DollarParser parser,
                      @NotNull Token token,
                      @NotNull List<Value> inputs,
                      @NotNull Pipeable callable) {
        return node(operation, name, pure, operation.nodeOptions(), parser,
                    new SourceImpl(scope(), token), null, inputs, callable);
    }

    @Override
    public void popScope(@NotNull Scope scope) {
        Scope poppedScope = endScope(true);
        if (!poppedScope.equals(scope)) {
            throw new DollarAssertionException("Popped scope does not equal expected scope");
        }
    }

    @Override
    public void pushScope(@NotNull Scope scope) {
        addScope(true, scope);
    }

    @Override
    public String randomId() {
        return UUID.randomUUID().toString();
    }

    @Override
    @NotNull
    public Value reactiveNode(@NotNull Op operation, @NotNull String name,
                              boolean pure, @NotNull SourceNodeOptions sourceNodeOptions,
                              @NotNull DollarParser parser,
                              @NotNull Source source,
                              @NotNull Value lhs,
                              @NotNull Value rhs,
                              @NotNull Pipeable callable) {
        final Value node = node(operation, name, pure, sourceNodeOptions, parser, source, null, Arrays.asList(lhs, rhs),
                                callable
        );


        rhs.$listen(i -> node.$notify(NotificationType.BINARY_RHS_CHANGE, node));
        lhs.$listen(i -> node.$notify(NotificationType.BINARY_LHS_CHANGE, node));
        return node;
    }

    @Override
    @NotNull
    public Value reactiveNode(@NotNull Op operation,
                              boolean pure,
                              @NotNull Token token,
                              @NotNull Value lhs,
                              @NotNull Value rhs,
                              @NotNull DollarParser parser,
                              @NotNull Pipeable callable) {
        return reactiveNode(operation, operation.name(), pure, operation.nodeOptions(), parser,
                            new SourceImpl(scope(),
                                           token), lhs,
                            rhs, callable);

    }

    @Override
    @NotNull
    public Value reactiveNode(@NotNull Op operation,
                              @NotNull String name,
                              boolean pure,
                              @NotNull Token token,
                              @NotNull Value lhs,
                              @NotNull Value rhs,
                              @NotNull DollarParser parser,
                              @NotNull Pipeable callable) {
        return reactiveNode(operation, name, pure, operation.nodeOptions(), parser,
                            new SourceImpl(scope(),
                                           token), lhs,
                            rhs, callable);

    }

    @Override
    @NotNull
    public Value reactiveNode(@NotNull Op operation,
                              boolean pure,
                              @NotNull DollarParser parser, @NotNull Source source,
                              @NotNull Value lhs,
                              @NotNull Value rhs,
                              @NotNull Pipeable callable) {
        return reactiveNode(operation, operation.name(), pure, operation.nodeOptions(), parser, source, lhs,
                            rhs, callable);

    }

    @Override
    @NotNull
    public Value reactiveNode(@NotNull Op operation,
                              boolean pure,
                              @NotNull Value lhs,
                              @NotNull Token token,
                              @NotNull DollarParser parser,
                              @NotNull Pipeable callable) {

        return reactiveNode(operation, pure, new SourceImpl(scope(), token), parser, lhs, callable
        );
    }

    @Override
    @NotNull
    public Value reactiveNode(@NotNull Op operation,
                              boolean pure,
                              @NotNull Source source,
                              @NotNull DollarParser parser,
                              @NotNull Value dependent,
                              @NotNull Pipeable callable) {

        final Value node = node(operation, operation.name(),
                                pure, operation.nodeOptions(), parser, source,
                                null, Collections.singletonList(dependent),
                                callable);
        dependent.$listen(i -> node.$notify(NotificationType.UNARY_VALUE_CHANGE, node));
        return node;
    }

    @Override
    @NotNull
    public Scope scope() {
        return scopes.get().get(scopes.get().size() - 1);
    }

    @Override
    @NotNull
    public List<Scope> scopes() {
        return scopes.get();
    }

    @Override
    @NotNull
    public Variable setVariable(@NotNull Scope scope,
                                @NotNull VarKey key,
                                @NotNull Value value,
                                @Nullable DollarParser parser,
                                @NotNull Token token,
                                @Nullable Value useConstraint,
                                @Nullable SubType useSource,
                                @NotNull VarFlags varFlags) {

        Source source = new SourceImpl(scope, token);
        boolean numeric = key.isNumeric();


        if (scope.has(key)) {
            return updateVariable(scope, key, value, varFlags, useConstraint, useSource);
        }
        try {
            List<Scope> scopes = new ArrayList<>(DollarUtilFactory.scopes.get());
            Collections.reverse(scopes);
            for (Scope scriptScope : scopes) {
                if (!(scriptScope instanceof PureScope) && varFlags.isPure()) {
                    log.debug("Skipping {}", scriptScope);
                }

                if (scriptScope.has(key)) {
                    return updateVariable(scriptScope, key, value, varFlags, useConstraint, useSource
                    );
                }

            }
        } catch (DollarAssertionException e) {
            ErrorHandlerFactory.instance().handle(scope, source, e);
            throw e;
        } catch (DollarScriptException e) {
            ErrorHandlerFactory.instance().handle(scope, source, e);
            throw e;
        } catch (RuntimeException e) {
            ErrorHandlerFactory.instance().handle(scope, source, e);
            throw e;
        }
        if (numeric) {
            return scope.parameter(key);
        }

        if (varFlags.isDeclaration()) {
            if (getConfig().debugScope()) {
                log.info("{} {} {}", highlight("SETTING  " + key, ANSI_CYAN), scope, scope);
            }
            return scope.set(key, value, useConstraint, useSource, varFlags);
        } else {
            throw new VariableNotFoundException(key, scope);
        }


    }

    @Override
    @NotNull
    public String shortHash(@NotNull Token token) {
        return new SourceImpl(scope(), token).getShortHash();
    }

    @Override
    @NotNull
    public Variable updateVariable(@NotNull Scope scope,
                                   @NotNull VarKey key,
                                   @NotNull Value value,
                                   @NotNull VarFlags varFlags,
                                   @Nullable Value useConstraint,
                                   @Nullable SubType useSource) {
        if (getConfig().debugScope()) {
            log.info("{}{} {}", highlight("UPDATING ", ANSI_CYAN), key, scope);
        }
        if (varFlags.isDeclaration()) {
            throw new DollarScriptException("Variable " + key + " already defined in " + scope);
        } else {
            return scope.set(key, value, useConstraint, useSource, varFlags);
        }
    }

    @Override
    @NotNull
    public Value variableNode(boolean pure, @NotNull VarKey key, @NotNull Token token, @NotNull DollarParser parser) {
        return variableNode(pure, key, false, null, token, parser);
    }

    @Override
    @NotNull
    public Value variableNode(boolean pure, @NotNull VarKey key,
                              boolean numeric, @Nullable Value defaultValue,
                              @NotNull Token token, @NotNull DollarParser parser) {
        Value node[] = new Value[1];
        UUID id = UUID.randomUUID();
        SourceImpl sourceCode = new SourceImpl(scope(), token);
        node[0] = node(VAR_USAGE_OP, "var-usage-" + key + "-" + sourceCode.getShortHash(), pure, parser, token,
                       $(key.toString()).$list().toVarList(),
                       (i) -> {
                           Scope scope = scope();

                           if (getConfig().debugScope()) {
                               log.info("{} {} in {} scopes ", highlight("LOOKUP " + key, ANSI_CYAN), scope,
                                        scopes.get().size());

                           }

                           if (scope.has(key)) {
                               Scope scopeForKey = scope.scopeForKey(key);
                               assert scopeForKey != null;
                               return getVar(key, id, scopeForKey, sourceCode, pure, node[0]);
                           }

                           try {
                               List<Scope> scopes = new ArrayList<>(DollarUtilFactory.scopes.get());
                               Collections.reverse(scopes);
                               for (Scope scriptScope : scopes) {
                                   if (!(scriptScope instanceof PureScope) && pure) {
                                       log.debug("Skipping {}", scriptScope);
                                   }

                                   if (scriptScope.has(key)) {
                                       Scope scopeForKey = scriptScope.scopeForKey(key);
                                       assert scopeForKey != null;
                                       return getVar(key, id, scopeForKey, sourceCode, pure, node[0]);

                                   }
                               }
                           } catch (DollarAssertionException e) {
                               throw e;
                           } catch (DollarScriptException e) {
                               return ErrorHandlerFactory.instance().handle(scope, null, e);
                           } catch (RuntimeException e) {
                               return ErrorHandlerFactory.instance().handle(scope, null, e);
                           }
                           if (numeric) {
                               throw new VariableNotFoundException(key, scope, sourceCode);
                           }

                           if (defaultValue != null) {
                               return defaultValue;
                           } else {
                               throw new VariableNotFoundException(key, scope);
                           }
                       }
        );
        node[0].metaAttribute(VARIABLE, key.asString());
        return node[0];

    }
}
